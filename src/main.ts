import { PonyWindowElement } from './PonyWindowElement'
import { PonyData, PonyAsset } from './loader'

const DEFAULT_PONY_FILES: [string, boolean][] = [
    ['assets/ponies/0_ShyPony.zip', false],
    ['assets/ponies/a16_Minty.zip', true],
    ['assets/ponies/a25_Byte.zip', true],
    ['assets/ponies/a26_Cyber.zip', true],
    ['assets/ponies/a27_ThornRose.zip', true],
]

async function loadDefaultPonies(): Promise<PonyData[]> {
    const ponies = []
    for (const [file, downloadable] of DEFAULT_PONY_FILES) {
        // console.log(`Fetching pony zip: ${file}`)
        const res = await fetch(new URL(file, window.location.href + "/"))
        if (!res.ok) {
            console.error(`Failed to fetch pony zip: ${file}`)
            continue
        }
        try {
            const zip = await res.arrayBuffer()
            ponies.push(await PonyData.loadFromFile(zip, downloadable ? file : undefined))
        } catch (e) {
            console.error(`Failed to load pony from zip: ${file}`, e)
        }
    }
    return ponies
}

async function main() {
    const ponies = await loadDefaultPonies()
    // console.log('Loaded default ponies.', ponies)


    const ponyList = document.getElementById('pony-list')
    if (!ponyList) return

    for (const pony of ponies) {
        const listItem = document.createElement('div')
        listItem.classList.add('pony-list-item')

        const title = document.createElement('h3')
        title.textContent = pony.name
        listItem.appendChild(title)

        const img = document.createElement('img')
        img.src = pony.assets.get(PonyAsset.RESTING)!.src
        img.alt = pony.name
        img.title = pony.name
        listItem.appendChild(img)

        const previewLink = document.createElement('a')
        previewLink.classList.add('link')
        previewLink.textContent = 'Preview Pony'
        previewLink.href = "#"

        listItem.appendChild(previewLink)

        if (pony.sourceUrl) {
            const sourceLink = document.createElement('a')
            sourceLink.classList.add('link')
            sourceLink.textContent = 'Download Pony'
            sourceLink.href = pony.sourceUrl
            listItem.appendChild(sourceLink)
        }

        ponyList.appendChild(listItem)

        previewLink.addEventListener('click', (e) => {
            e.preventDefault()
            console.log('Pony clicked:', pony.name)
            const x = window.open('', undefined, 'popup,top=100,left=400,width=400,height=430,scrollbars=no,resizable=no')
            if(x) {
                x.document.defaultView!.customElements.define('pony-window', PonyWindowElement)

                const ponyWindow = new PonyWindowElement(pony.assets)
                x.document.body.appendChild(ponyWindow)

                const style = x.document.createElement('style')
                style.textContent = `
                    body {
                        margin: 0;
                        padding: 0;
                        overflow: hidden;
                    }
                `
                x.document.head.appendChild(style)

                const title = x.document.createElement('title')
                title.textContent = "Boop The Pony"
                x.document.head.appendChild(title)
            }
        })
    }
}

if (document.readyState !== 'loading') main().catch(console.error)
else document.addEventListener('DOMContentLoaded', () => main().catch(console.error))
