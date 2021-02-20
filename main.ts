import {App, HeadingCache, Plugin, TFile} from 'obsidian';

export default class BacklinksInDocument extends Plugin {
    hasRelatedHeading(file: TFile): boolean {
        if (!file || !this.app.metadataCache.getFileCache(file).headings) {return false}
        return this.app.metadataCache.getFileCache(file).headings.some(heading => {
            return heading.heading === "Related" && heading.level === 5
        })
    }
    
    getRelatedHeading(file: TFile): HeadingCache {
        return this.app.metadataCache.getFileCache(file).headings.find(heading => {
            return heading.heading === "Related" && heading.level === 5
        })
    }

    // TODO: will likely have to cache this later
    buildReverseIndex(): Record<string, string[]> {
        let res: Record<string, string[]> = {}
        const links = this.app.metadataCache.resolvedLinks
        for (let source in links) {
            for (let link in links[source]) {
                if (!res[link]) {res[link] = []}
                res[link].push(source)
            }
        }
        return res
    }

    async onload() {
        this.app.workspace.on('file-open', async (file) => {
            if (!this.hasRelatedHeading(file)) {return}

            const relatedHeading = this.getRelatedHeading(file)

            const originalContents = await this.app.vault.read(file)
            const coreContents = originalContents.slice(0, relatedHeading.position.start.offset) // Assumes related is positioned at the end
            const relatedNotes = new RelatedNotes(this.buildReverseIndex()[file.path], this.app)

            const newContents = `${coreContents}${relatedNotes.text}`
            if (newContents !== originalContents) {
                this.app.vault.modify(file, newContents)
            }
        })
    }
}

class RelatedNotes {
    readonly permanent: string[]
    readonly literature: string[]
    constructor(backlinks: string[], app: App) {
        this.permanent = []
        this.literature = []
        backlinks.forEach(link => {
            const file = app.vault.getAbstractFileByPath(link)
            if (file instanceof TFile) {
                const type = (app.metadataCache.getFileCache(file).frontmatter["type"] as string)
                if (type.toLowerCase().contains("permanent")) {this.permanent.push(app.metadataCache.fileToLinktext(file, file.path))}
                if (type.toLowerCase().contains("literature")) {this.literature.push(app.metadataCache.fileToLinktext(file, file.path))}
            }
        })
    }

    get text(): string {
        const perm = (this.permanent.length > 0 ? this.permanent.map(link => {return `[[${link}]]`}).reduce((prev, value, i, arr) => {return `${prev}\n${value}`}) : "")
        const lit = (this.literature.length > 0 ? this.literature.map(link => {return `[[${link}]]`}).reduce((prev, value, i, arr) => {return `${prev}\n${value}`}) : "")
        return `##### Related
###### Permanent Notes
${perm}

###### Literature Notes
${lit}`
    }
}
