export class ShakeDetector extends EventTarget {
    public minDurationMs = 500;
    public sensitivityPx = 10;
    public checkIntervalMs = 400;
    private window: Window | null = null;
    private lastXY = [0, 0];
    private movingStartTime = 0;
    private shakingStartTime = 0;
    private checkerTimer: NodeJS.Timeout | null = null;
    public constructor() {
        super();
    }
    public attach(window: Window) {
        this.window = window;
        this.lastXY = [window.screenX, window.screenY];
        this.checkerTimer = setTimeout(() => this.checkForShake(), this.checkIntervalMs);
    }
    public detach() {
        this.window = null;
        if (this.checkerTimer) clearTimeout(this.checkerTimer);
        this.movingStartTime = 0;
        if (this.shakingStartTime > 0) {
            // Stopped shaking
            this.dispatchEvent(new Event('shakeend'));
            this.shakingStartTime = 0;
        }
        this.checkerTimer = null;
    }
    private checkForShake() {
        if (!this.window) return;
        const [x, y] = this.lastXY;
        const [newX, newY] = [this.window.screenX, this.window.screenY];
        const timestamp = Date.now();
        // Check if the window has moved
        if (Math.abs(newX - x) > this.sensitivityPx || Math.abs(newY - y) > this.sensitivityPx) {
            // Window Moved
            if (this.movingStartTime > 0) {
                // Already moving
                if (timestamp - this.movingStartTime > this.minDurationMs) {
                    // Moved for long enough to be shaking
                    if (this.shakingStartTime > 0) {
                        // Still shaking
                    } else {
                        // Started shaking
                        this.dispatchEvent(new Event('shakestart'));
                        this.shakingStartTime = timestamp;
                    }
                }
            } else {
                // Started moving
                this.movingStartTime = timestamp;
            }
        } else {
            // Not moving
            this.movingStartTime = 0;
            if (this.shakingStartTime > 0) {
                // Stopped shaking
                this.dispatchEvent(new Event('shakeend'));
                this.shakingStartTime = 0;
            }
        }
        this.lastXY = [newX, newY];
        this.checkerTimer = setTimeout(() => this.checkForShake(), this.checkIntervalMs);
    }
}
