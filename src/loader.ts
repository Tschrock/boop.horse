import JSZip from 'jszip';

export enum PonyAsset {
    RESTING,
    BOOPED_1,
    BOOPED_2,
    BOOPED_3,
    BOOPED_4,
    CUTIE_MARK,
    INACTIVE,
    SCARED,
    FRAME,
    BROKEN,
}

const PONY_ASSET_SEARCH = new Map<PonyAsset, RegExp>([
    [PonyAsset.RESTING, /\/0.png$/i],
    [PonyAsset.BOOPED_1, /\/1.png$/i],
    [PonyAsset.BOOPED_2, /\/2.png$/i],
    [PonyAsset.BOOPED_3, /\/3.png$/i],
    [PonyAsset.BOOPED_4, /\/4.png$/i],
    [PonyAsset.CUTIE_MARK, /\/cm.png$/i],
    [PonyAsset.INACTIVE, /\/inactivity.png$/i],
    [PonyAsset.SCARED, /\/move.png$/i],
    [PonyAsset.FRAME, /\/layout.png$/i],
])

/**
 * Attempts to extract the name of a pony from the name of its folder.
 * @param folderName The name of the pony folder.
 * @returns The name of the pony.
 */
function extractPonyName(folderName: string): string {
    return folderName.split('_').slice(1).join(' ').replace(/([A-Z])/g, ' $1').trim()
}

export class PonyData {
    name: string
    assets: Map<PonyAsset, HTMLImageElement>
    sourceUrl?: string
    constructor(name: string, assets: Map<PonyAsset, HTMLImageElement>, sourceUrl?: string) {
        this.name = name
        this.assets = assets
        this.sourceUrl = sourceUrl
    }
    static async loadFromFile(data: Blob | ArrayBuffer, url?: string): Promise<PonyData> {
        const zip = await JSZip.loadAsync(data)
        let ponyFolderName = zip.name
        const assets = new Map<PonyAsset, HTMLImageElement>()
        for (const [frame, search] of PONY_ASSET_SEARCH.entries()) {
            const matchingFiles = zip.file(search)
            if (!matchingFiles || matchingFiles.length == 0) throw new Error(`No file found for ${PonyAsset[frame]} state.`)
            const file = matchingFiles[0]
            const img = new Image()
            const fileData = await file.async('blob')
            img.src = URL.createObjectURL(fileData)
            assets.set(frame, img)
            ponyFolderName = file.name.split('/').slice(-2)[0]
        }
        return new PonyData(extractPonyName(ponyFolderName), assets, url)
    }
    public clone(): PonyData {
        return new PonyData(this.name, new Map([...this.assets.entries()].map(([k, v]) => [k, v.cloneNode() as HTMLImageElement])))
    }
}
