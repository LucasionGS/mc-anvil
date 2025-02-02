function mockFileSystem(root: DirectoryEntry | any): FileSystem {
    return {
        name: "",
        root
    };
}

export class MockDirectoryEntry implements DirectoryEntry {
    
    public name: string;
    public isFile: boolean = false;
    public isDirectory: boolean = true;
    public fullPath: string;
    public filesystem: FileSystem;
    private children: Entry[] = [];
    private parent: DirectoryEntry;

    constructor(name: string, parent?: MockDirectoryEntry) {
        this.name = name;
        this.fullPath = (parent?.fullPath || "") + name + "/";
        this.parent = parent || this;
        this.filesystem = parent?.filesystem || mockFileSystem(this);
        if (parent) parent.addChild(this);
    }

    addChild(child: Entry) {
        this.children.push(child);
    }

    getDirectory(name: string, _: Flags | undefined, success: (d: DirectoryEntry) => void, error: (e: any) => void) {
        const d = this.children.find(x => x.isDirectory && x.name === name);
        if (d) success(d as DirectoryEntry); else error(`No directory named ${name} found within ${this.fullPath}`);
    }

    getFile(name: string, _: Flags | undefined, success: (f: FileEntry) => void, error: (e: any) => void) {
        const f = this.children.find(x => x.isFile && x.name === name) as FileEntry;
        if (f) success(f as FileEntry); else error(`No file named ${name} found within ${this.fullPath}`);
    }

    getParent() { return this.parent; }

    readEntries(success: (entries: Entry[]) => void, _: (e: any) => void) {
        success(this.children);
    }

    createReader() {
        return {
            readEntries: this.readEntries.bind(this)
        };
    }

    copyTo() {}
    moveTo() {}
    removeRecursively() {}
    getMetadata() {}
    toURL() { return this.fullPath; }
    remove() {}

}

export class MockFileEntry implements FileEntry {

    public name: string;
    public parent: DirectoryEntry;
    public isFile: boolean = true;
    public isDirectory: boolean = false;
    public fullPath: string;
    public filesystem: FileSystem;

    constructor(name: string, parent: MockDirectoryEntry) {
        this.name = name;
        this.parent = parent;
        this.fullPath = parent.fullPath + name;
        this.filesystem = parent.filesystem;
        parent.addChild(this);
    }

    getMetadata() {}
    moveTo() {}
    copyTo() {}
    toURL() { return this.fullPath; }
    remove() {}
    createWriter() {}

    getParent() {
        return this.parent;
    }

    file() {}

}
