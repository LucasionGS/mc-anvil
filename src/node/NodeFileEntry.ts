/// <reference types="node" />
import * as fsp from "fs/promises";
import * as path from "path";

enum NodeEntryType {
  File,
  Directory
}

export abstract class NodeEntry {
  constructor(protected path: string, protected type: NodeEntryType) {

  }

  isFile(): this is NodeFileEntry {
    return this.type === NodeEntryType.File;
  }
  
  isDirectory(): this is NodeDirectoryEntry {
    return this.type === NodeEntryType.Directory;
  }

  public getPath(): string {
    return this.path;
  }
}

export class NodeFileEntry extends NodeEntry {
  constructor(path: string) {
    super(path, NodeEntryType.File);
  }

  async read(): Promise<string>;
  async read(encoding: "utf8"): Promise<Buffer>;
  async read(encoding?: "utf8"): Promise<Buffer | string> {
    return fsp.readFile(this.path, encoding);
  }
}

export class NodeDirectoryEntry extends NodeEntry {

  constructor(path: string) {
    super(path, NodeEntryType.Directory);
  }

  public async read(): Promise<NodeEntry[]> {
    return fsp.readdir(this.path)
      .then(files => Promise.all(files.map(async x => {
        const p = path.join(this.path, x);
        return await fsp.stat(p)
          .then(stat => stat.isDirectory() ? new NodeDirectoryEntry(p) : new NodeFileEntry(p));
      })));
  }
}