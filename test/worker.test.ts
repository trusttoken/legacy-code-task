import { DownloadWorker } from '../src/worker'
import { mockFileSystem } from '../src/environment'
import { expect } from 'chai'

export function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

describe('DownloadWorker', function () {
    it('downloads files to a specified directory', async function () {
        const worker = new DownloadWorker('/some/dir')

        worker.start()
        worker.appendDownload('www.example.org/cat.jpeg')
        worker.appendDownload('www.example.org/dog.jpeg')

        await sleep(100)
        worker.stop()

        const files = mockFileSystem.getFiles('/some/dir')
        expect(files).to.have.lengthOf(2)
    })
})
