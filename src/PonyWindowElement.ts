import { ShakeDetector } from './ShakeDetector'
import { PonyAsset } from './loader'

const VIEWPORT_ASPECT_RATIO = 1594 / 1714

export class PonyWindowElement extends HTMLElement {
    /** The current pony state. */
    private state: PonyAsset = PonyAsset.RESTING

    /** The preloaded image elements for each state. */
    private assetImages = new Map<PonyAsset, HTMLImageElement>()

    /** The element containing the pony image. */
    private ponyImageDiv: HTMLDivElement

    /** The boop button element. */
    private boopButton: HTMLDivElement

    /** The cutiemark button element. */
    private cutiemarkButton: HTMLDivElement

    /** The close button element. */
    private closeButton: HTMLDivElement

    /** The window shake detector. */
    private shakeDetector: ShakeDetector

    /** The number of recent boops. */
    private boopCount: number = 0

    /** The number of milliseconds to wait before resetting the boop state. */
    private boopTimeoutMs: number = 1000

    /** The boop timer. */
    private boopTimer: NodeJS.Timeout | null = null

    /** The state transitions for boop counts. */
    private boopTransitions = new Map([
        [1, PonyAsset.BOOPED_1],
        [4, PonyAsset.BOOPED_2],
        [7, PonyAsset.BOOPED_3],
        [12, PonyAsset.BOOPED_4],
        [24, PonyAsset.BROKEN]
    ])

    /** The number of milliseconds to wait before resetting the scared state. */
    private scaredTimeoutMs: number = 1000

    /** The scared timer. */
    private scaredTimer: NodeJS.Timeout | null = null

    /** The number of milliseconds to wait before switching to the inactive state. */
    private inactiveTimeoutMs: number = 4000

    /** The inactive timer. */
    private inactiveTimer: NodeJS.Timeout | null = null

    /** Tracks the titlebar drag coords */
    private dragScreenXY: [number, number] | null = null

    /** The window resize debounce timeout. */
    private resizeDebounceTimer: NodeJS.Timeout | null = null

    /** Whether to ignore the next resize event. */
    private ignoreNextResize: boolean = false

    constructor(src: Map<PonyAsset, HTMLImageElement>) {
        super()

        this.shakeDetector = new ShakeDetector()
        this.shakeDetector.addEventListener('shakestart', this.shakeStarted.bind(this))
        this.shakeDetector.addEventListener('shakeend', this.shakeStopped.bind(this))

        // Create the shadow root
        const shadow = this.attachShadow({ mode: 'open' })
        const style = this.ownerDocument.createElement('style')
        style.textContent = `
            .window {
                width: 100%;
                height: 100%;
                position: relative;
            }
            .titlebar {
                width: 100%;
                height: 12%;
                position: absolute;
                top: 0;
                left: 0;
                z-index: 3;
            }
            .close-button {
                width: 6%;
                height: 50%;
                position: absolute;
                top: 20%;
                right: 3.5%;
                cursor: pointer;
                z-index: 3;
            }
            .cutiemark-button {
                width: 10%;
                height: 10%;
                position: absolute;
                bottom: 10%;
                right: 10%;
                cursor: pointer;
                z-index: 3;
            }
            .boop-button {
                width: 20%;
                height: 20%;
                position: absolute;
                top: 40%;
                left: 40%;
                cursor: pointer;
                z-index: 3;
            }
            .windowframe-image {
                width: 100%;
                position: absolute;
                top: 0;
                left: 0;
                z-index: 0;
            }
            .cutiemark-image {
                width: 100%;
                position: absolute;
                top: 0;
                left: 0;
                z-index: 2;
            }
            .pony-image {
                width: 100%;
                position: absolute;
                top: 0;
                left: 0;
                z-index: 1;
            }
            .pony-image img {
                width: 100%;
            }
            .pony-image .loading {
                text-align: center;
                vertical-align: middle;
                font-family: monospace;
            }
            .imgcache {
                opacity: 0;
                z-index: -100;
            }`

        const windowDiv = this.ownerDocument.createElement('div')
        windowDiv.classList.add('window')

        const windowframeImage = this.ownerDocument.createElement('img')
        windowframeImage.classList.add('windowframe-image')
        windowframeImage.src = src.get(PonyAsset.FRAME)!.src

        this.assetImages.set(PonyAsset.FRAME, windowframeImage)

        const cutiemarkImage = this.ownerDocument.createElement('img')
        cutiemarkImage.classList.add('cutiemark-image')
        cutiemarkImage.src = src.get(PonyAsset.CUTIE_MARK)!.src

        this.assetImages.set(PonyAsset.CUTIE_MARK, cutiemarkImage)

        const imgcacheDiv = this.ownerDocument.createElement('div')
        imgcacheDiv.classList.add('imgcache')

        for (const [k, v] of src.entries()) {
            const img = this.ownerDocument.createElement('img')
            img.src = v.src
            imgcacheDiv.appendChild(img)
            this.assetImages.set(k, img)
        }

        this.ponyImageDiv = this.ownerDocument.createElement('div')
        this.ponyImageDiv.classList.add('pony-image')

        const loadingDiv = this.ownerDocument.createElement('div')
        loadingDiv.classList.add('loading')
        loadingDiv.textContent = 'Loading...'

        this.ponyImageDiv.appendChild(loadingDiv)

        const titlebarDiv = this.ownerDocument.createElement('div')
        titlebarDiv.classList.add('titlebar')
        titlebarDiv.draggable = true
        titlebarDiv.addEventListener('dragstart', this.titlebarDragStart.bind(this))
        titlebarDiv.addEventListener('drag', this.titlebarDrag.bind(this))
        titlebarDiv.addEventListener('dragend', this.titlebarDragEnd.bind(this))

        this.closeButton = this.ownerDocument.createElement('div')
        this.closeButton.classList.add('close-button')
        this.closeButton.addEventListener('click', this.closeClicked.bind(this))

        titlebarDiv.appendChild(this.closeButton)

        this.cutiemarkButton = this.ownerDocument.createElement('div')
        this.cutiemarkButton.classList.add('cutiemark-button')
        this.cutiemarkButton.addEventListener('click', this.cutiemarkClicked.bind(this))

        this.boopButton = this.ownerDocument.createElement('div')
        this.boopButton.classList.add('boop-button')
        this.boopButton.addEventListener('click', this.boopClicked.bind(this))

        windowDiv.append(imgcacheDiv, windowframeImage, cutiemarkImage, this.ponyImageDiv, titlebarDiv, this.boopButton, this.cutiemarkButton)
        shadow.append(style, windowDiv)
        this.setState(PonyAsset.RESTING)
    }

    connectedCallback() {
        const mywindow = this.ownerDocument.defaultView
        console.log('Connected to window:', mywindow)
        if (mywindow) {
            this.shakeDetector.attach(mywindow)
            mywindow.addEventListener('resize', this.windowResized.bind(this))

            if (mywindow.document.readyState !== 'loading') setTimeout(() => this.fixViewport(), 100)
            else mywindow.document.addEventListener('DOMContentLoaded', () => setTimeout(() => this.fixViewport(), 100))
        }

        this.anyInteraction()
    }

    disconnectedCallback() {
        this.shakeDetector.detach()
        if (this.boopTimer) clearTimeout(this.boopTimer)
        if (this.scaredTimer) clearTimeout(this.scaredTimer)
        if (this.inactiveTimer) clearTimeout(this.inactiveTimer)
    }

    adoptedCallback() {
        Object.setPrototypeOf(this, PonyWindowElement.prototype);
        this.shakeDetector.detach()
        if (this.ownerDocument.defaultView) this.shakeDetector.attach(this.ownerDocument.defaultView)
        this.anyInteraction()
    }

    attributeChangedCallback(name: string, oldValue: string, newValue: string) {
        // console.log(`Attribute ${name} has changed.`);
    }

    private boopClicked() {
        // console.log('Boop clicked')
        this.anyInteraction()
        // Clear the boop timer
        if (this.boopTimer) clearTimeout(this.boopTimer)
        // Can't boop when scared
        if (this.state == PonyAsset.SCARED) return
        // Add the boop
        this.boopCount++
        // Check if there's a new state
        const newState = this.boopTransitions.get(this.boopCount)
        if (newState) {
            this.setState(newState)
        }
        // Reset the boop state after a timeout
        this.boopTimer = setTimeout(() => {
            this.setState(PonyAsset.RESTING)
        }, this.boopTimeoutMs)
    }

    private cutiemarkClicked() {
        // console.log('Cutiemark clicked')
        this.anyInteraction()
        // TODO?
    }

    private closeClicked() {
        // console.log('Close clicked')
        this.anyInteraction()
        this.ownerDocument.defaultView?.close()
    }

    private shakeStarted() {
        // console.log('Shake started')
        // Clear the inactive timer
        if (this.inactiveTimer) clearTimeout(this.inactiveTimer)
        if (this.boopTimer) clearTimeout(this.boopTimer)
        // Clear boops
        this.boopCount = 0
        // Disable booping
        this.boopButton.style.display = 'none'
        // Set the scared state
        this.setState(PonyAsset.SCARED)
    }

    private shakeStopped() {
        // console.log('Shake stopped')
        setTimeout(() => {
            // Reset the state
            this.setState(PonyAsset.RESTING)
            // Enable booping
            this.boopButton.style.display = 'block'
            // Update the inactive timer
            this.anyInteraction()
        }, 1000)
    }

    private titlebarDragStart(event: DragEvent) {
        console.log('Titlebar drag start')
        this.anyInteraction()
        this.dragScreenXY = [event.screenX, event.screenY]
    }

    private titlebarDrag(event: DragEvent) {
        console.log('Titlebar drag')
        this.anyInteraction()
        // const diffX = event.screenX - this.dragScreenXY![0]
        // const diffY = event.screenY - this.dragScreenXY![1]
        // console.log('Diff:', diffX, diffY)
        // this.dragScreenXY = [event.screenX, event.screenY]
        // this.ownerDocument.defaultView?.moveBy(diffX/2, diffY/2)
    }

    private titlebarDragEnd(event: DragEvent) {
        console.log('Titlebar drag end')
        this.anyInteraction()
        const diffX = event.screenX - this.dragScreenXY![0]
        const diffY = event.screenY - this.dragScreenXY![1]
        console.log('Diff:', diffX, diffY)
        this.dragScreenXY = [event.screenX, event.screenY]
        this.ownerDocument.defaultView?.moveBy(diffX, diffY)
        this.dragScreenXY = null
    }

    private windowResized() {
        if (this.ignoreNextResize) {
            this.ignoreNextResize = false
            return
        }
        console.log('Window resized')
        if (this.resizeDebounceTimer) clearTimeout(this.resizeDebounceTimer)
        this.resizeDebounceTimer = setTimeout(() => {
            this.fixViewport()
        }, 500)
    }

    private fixViewport() {
        const mywindow = this.ownerDocument.defaultView
        if (!mywindow) return
        const windowWidth = mywindow.innerWidth
        const windowHeight = mywindow.innerHeight
        const newHeight = windowWidth / VIEWPORT_ASPECT_RATIO
        const heightDiff = windowHeight - newHeight
        this.ignoreNextResize = true
        mywindow.resizeTo(mywindow.outerWidth, mywindow.outerHeight - heightDiff)

    }

    private anyInteraction() {
        // Reset the inactive timer
        if (this.inactiveTimer) clearTimeout(this.inactiveTimer)
        this.inactiveTimer = setTimeout(() => {
            this.setState(PonyAsset.INACTIVE)
        }, this.inactiveTimeoutMs)
    }

    private setState(state: PonyAsset) {
        // console.log('Setting state:', state)
        this.state = state
        this.ponyImageDiv.replaceChildren(this.assetImages.get(state)!)
        if (state == PonyAsset.RESTING) this.boopCount = 0
    }
}

window.customElements.define('pony-window', PonyWindowElement);
