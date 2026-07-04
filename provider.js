class Provider {
    api = "https://subsplease.org/rss/"

    getSettings() {
        return {
            canSmartSearch: true,
            smartSearchFilters: ["episodeNumber", "resolution", "query"],
            supportsAdult: false,
            type: "main"
        }
    }

    async search(opts) {
        const cleanQuery = this.cleanSearchTerm(opts.query);
        const url = `${this.api}?t=${encodeURIComponent(cleanQuery)}`
        return await this.fetchAndParseRss(url)
    }

    async smartSearch(opts) {
        let baseTitle = opts.query || opts.media.romajiTitle || opts.media.englishTitle || "";
        baseTitle = this.cleanSearchTerm(baseTitle);

        let url = `${this.api}?t=${encodeURIComponent(baseTitle)}`;
        let results = await this.fetchAndParseRss(url);

        if (results.length === 0 && opts.media.englishTitle && opts.media.englishTitle !== opts.media.romajiTitle) {
            let engTitle = this.cleanSearchTerm(opts.media.englishTitle);
            url = `${this.api}?t=${encodeURIComponent(engTitle)}`;
            results = await this.fetchAndParseRss(url);
        }

        if (opts.resolution) {
            const resKeyword = opts.resolution.toLowerCase();
            results = results.filter(t => t.name.toLowerCase().includes(resKeyword));
        }

        if (opts.episodeNumber > 0) {
            const epStr = opts.episodeNumber < 10 ? `0${opts.episodeNumber}` : `${opts.episodeNumber}`;
            results = results.filter(t => t.name.includes(` ${epStr} `) || t.name.includes(` - ${epStr}`));
        }

        return results;
    }

    cleanSearchTerm(text) {
        if (!text) return "";
        return text
            .replace(/[:,\-–\!]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    async fetchAndParseRss(url) {
        try {
            const res = await fetch(url)
            if (!res.ok) throw new Error(res.statusText)
            const txt = await res.text()
            return this.parseSubsPleaseXml(txt)
        } catch (e) {
            console.error("SubsPlease fetch failed: ", e)
            return []
        }
    }

    parseSubsPleaseXml(txt) {
        const torrents = []
        const items = txt.split('<item>')

        for (let i = 1; i < items.length; i++) {
            const item = items[i]
            const tag = (t) => {
                const m = item.match(new RegExp(`<${t}>?([^<>]+)</${t}>`))
                return m ? m[1].trim() : ''
            }

            const title = tag('title')
            const guid = tag('guid')
            const pubDate = tag('pubDate')
            const downloadUrl = tag('link') 

            if (title) {
                torrents.push({
                    name: title,
                    date: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
                    size: 0,            
                    formattedSize: '',
                    seeders: 100,        
                    leechers: 10,
                    downloadCount: 0,
                    link: guid || downloadUrl,
                    downloadUrl: "",    
                    magnetLink: downloadUrl,
                    infoHash: this.extractHashFromMagnet(downloadUrl),
                    episodeNumber: -1,  
                    isBestRelease: true, 
                    confirmed: true
                })
            }
        }
        return torrents
    }

    extractHashFromMagnet(magnetStr) {
        if (!magnetStr) return "";
        const match = magnetStr.match(/btih:([a-zA-Z0-9]+)/);
        return match ? match[1].toLowerCase() : "";
    }

    async getTorrentInfoHash(t) { return t.infoHash || '' }
    async getTorrentMagnetLink(t) { return t.magnetLink || '' }
    async getLatest() { return await this.fetchAndParseRss(this.api) }
}
