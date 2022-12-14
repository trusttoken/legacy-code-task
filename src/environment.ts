import path from 'path'

class MockFile {
    name: string

    constructor(name: string) {
        this.name = name
    }
}

class MockFileSystem {
    directories = new Map<string, MockFile[]>()

    saveFile(dirPath: string, file: MockFile) {
        let directory = this.directories.get(dirPath)
        if (directory === undefined) {
            directory = []
            this.directories.set(dirPath, directory)
        }
        directory.push(file)
    }

    getFiles(dirPath: string): MockFile[] {
        return this.directories.get(dirPath) ?? []
    }
}

export const mockFileSystem = new MockFileSystem()

export function mockFetch(url: string): MockFile {
    const fileName = path.basename(url) // "www.example.org/cat.jpeg" -> "cat.jpeg"
    return new MockFile(fileName)
}

