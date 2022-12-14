import { clearInterval } from 'timers'
import { mockFetch, mockFileSystem } from './environment'

enum Code {
    Success,
    InProgress,
    ConnectionError,
    Timeout,
    HttpError,
}

class DownloadResult {
    public getCode() {
        return Code.Success
    }

    public getHTTPCode() {
        return 200
    }
}

class Download {
    url: string
    downloadDir: string

    constructor(url: string, downloadDir: string) {
        this.url = url
        this.downloadDir = downloadDir
    }

    start() {
        console.log(`Downloading from ${this.url} ...`)
    }

    process() {
        const file = mockFetch(this.url)
        mockFileSystem.saveFile(this.downloadDir, file)
        return new DownloadResult()
    }

    cancel() {
        console.log(`Cancelled download from ${this.url} ...`)
    }
}

enum State {
    Pending,
    InProgress,
    Complete
}

class DownloadState {
    url: string
    currentDownload: Download | undefined
    state: State = State.Pending
    attempts: number = 0

    constructor(url: string) {
        this.url = url
    }

    getUrl() {
        return this.url
    }

    setDownloader(download: Download) {
        this.currentDownload = download
    }

    getDownloader() {
        return this.currentDownload
    }

    getState() {
        return this.state
    }

    moveTo(state: State) {
        this.state = state
    }

    getAttempts() {
        return this.attempts
    }

    incrementAttempts() {
        this.attempts++
    }
}

export class DownloadWorker {
    private downloadDir: string
    private requestedUrls: string[] = []
    private downloads: DownloadState[] = []
    private failedUrls: string[] = []
    private connectionDisabled: boolean = false
    private interval: NodeJS.Timer | undefined
    private maxAttempts = 0

    constructor(downloadDir: string) {
        this.downloadDir = downloadDir
    }

    appendDownload(url: string) {
        this.requestedUrls.push(url)
    }

    private processPendingDownload(download: DownloadState) {
        const downloader = new Download(download.getUrl(), this.downloadDir)
        downloader.start()
        download.setDownloader(downloader)
        download.moveTo(State.InProgress)
    }

    start() {
        this.interval = setInterval(() => {
            while (this.requestedUrls.length > 0) {
                const url = this.requestedUrls.shift()!
                this.downloads.push(new DownloadState(url))
            }

            if (!this.connectionDisabled) {
                for (let i = 0; i < this.downloads.length && !this.connectionDisabled; i++) {
                    const download = this.downloads[i]

                    if (download.getState() === State.Pending) {
                        this.processPendingDownload(download)
                    }

                    if (download.getState() === State.InProgress) {
                        const result = download.getDownloader()!.process()

                        switch (result.getCode()) {
                            case Code.Success:
                                download.moveTo(State.Complete)
                                break
                            case Code.InProgress:
                                /* Nothing to do */
                                break
                            case Code.Timeout:
                            case Code.ConnectionError:
                                if (download.getAttempts() > this.maxAttempts) {
                                    this.connectionDisabled = true
                                } else {
                                    download.incrementAttempts()
                                    download.moveTo(State.InProgress)
                                }
                                break
                            case Code.HttpError:
                                const HTTP_REQUEST_TIMEOUT = 408
                                const HTTP_BAD_GATEWAY = 502
                                const HTTP_SERVICE_UNAVAILABLE = 503
                                const HTTP_GATEWAY_TIMEOUT = 504

                                const httpCode = result.getHTTPCode()
                                if (httpCode === HTTP_REQUEST_TIMEOUT ||
                                    httpCode === HTTP_BAD_GATEWAY ||
                                    httpCode === HTTP_SERVICE_UNAVAILABLE ||
                                    httpCode === HTTP_GATEWAY_TIMEOUT) {
                                    this.failedUrls.push(download.getUrl())
                                    download.moveTo(State.Complete)
                                } else {
                                    if (download.attempts > this.maxAttempts) {
                                        download.moveTo(State.Complete)
                                    } else {
                                        download.incrementAttempts()
                                        download.moveTo(State.InProgress)
                                    }
                                }
                                break
                        }
                    }

                    if (download.getState() === State.Complete) {
                        this.downloads.splice(i, 1) // remove element at index i
                        i-- // adjust the iterator
                    }
                }
            }

            if (this.connectionDisabled) {
                while (this.downloads.length > 0) {
                    const download = this.downloads.shift()!
                    if (download.getState() === State.InProgress) {
                        download.getDownloader()!.cancel()
                    }
                    this.failedUrls.push(download.getUrl())
                }
                clearInterval(this.interval)
            }
        }, 10)
    }

    stop() {
        this.connectionDisabled = true
    }

    getFailedUrls() {
        return this.failedUrls
    }
}

