import { BlockStates, ChunkRootTag, ChunkSectionTag, Coordinate3D, Palette } from './types';
import { TagData, TagType } from "../nbt";
import { findChildTagAtPath, findCompoundListChildren } from "../nbt/nbt";
import { BlockDataParser, paletteNameList } from './block';
import { BinaryParser, BitParser } from '../util';

export const AIR = -968583441; // hash of "minecraft:air()"
export const BLOCKS_PER_CHUNK = 4096; // 16 * 16 * 16

export function isValidChunkSectionTag(tag?: TagData): tag is ChunkSectionTag {
    const t = tag as ChunkSectionTag;
    return t && t.type === TagType.LIST && t.name === "Sections" && t.data && t.data.subType === TagType.COMPOUND
        && t.data.data && t.data.data.length !== undefined;
}

export function isValidChunkRootTag(tag?: TagData): tag is ChunkRootTag {
    const t = tag as ChunkRootTag;
    return t && t.type === TagType.COMPOUND && t.name === "" && t.data && t.data.length !== undefined;
}

export function sortedSections(tag: TagData): TagData[][] | undefined {
    if (!isValidChunkRootTag(tag)) return;
    const sectionTag = findChildTagAtPath("Level/Sections", tag);
    if (!isValidChunkSectionTag(sectionTag)) return [];
    const yTags = findCompoundListChildren(sectionTag!, x => x.name === "Y")?.map( (v, i) => ({ v, i }) ).filter(x => x.v);
    return yTags?.sort( (a, b) => (a.v!.data as number) - (b.v!.data as number) ).map( x => sectionTag.data.data[x.i] );
}

export function getCoordinates(tag: TagData): [ number, number ] | undefined {
    if (!isValidChunkRootTag(tag)) return;
    const x = findChildTagAtPath("Level/xPos", tag)?.data;
    const z = findChildTagAtPath("Level/zPos", tag)?.data;
    if (x !== undefined && z !== undefined) return [ x as number * 16, z as number * 16 ];
}

export function uniqueBlockNames(chunkRootTag: TagData): Set<string> {
    return new Set(
        sortedSections(chunkRootTag)?.flatMap(x => paletteNameList(x.find(xx => xx.name === "Palette") as Palette)) || []
    );
}

export function findBlocksByName(chunkRootTag: TagData, name: string): Coordinate3D[] {
    const sections = sortedSections(chunkRootTag);
    if (sections === undefined) return [];
    return sections.flatMap( (section, y) => {
        const yy = y * 16;
        const [ xx, zz ] = getCoordinates(chunkRootTag) || [ 0, 0 ];
        const blockData = section.find(x => x.name === "BlockStates");
        const palette = section.find(x => x.name === "Palette");
        if (blockData === undefined || palette === undefined) return [];
        return (new BlockDataParser(blockData as BlockStates, palette as Palette))
            .findBlocksByName(name)
            .map(chunkCoordinateFromIndex)
            .map(x => [ x[0] + xx, x[1] + yy, x[2] + zz ] as Coordinate3D);
    });
}

export function chunkCoordinateFromIndex(index: number): Coordinate3D {
    return [
        index % 16,
        Math.floor(index / 256),
        Math.floor(index / 16) % 16
    ];
}

export function indexFromChunkCoordinate(coordinate: Coordinate3D): number {
    const [ x, y, z ] = coordinate;
    return (y * 16 + z) * 16 + x;
}

export function biomeCoordinateFromIndex(index: number): Coordinate3D {
    return [
        index % 4,
        Math.floor(index / 16),
        Math.floor(index / 4) % 4
    ];
}

export function indexFromBiomeCoordinate(coordinate: Coordinate3D): number {
    const [ x, y, z ] = coordinate;
    return (y * 4 + z) * 4 + x;
}

function emptyX(limit: number = 256, innerLimit: number = 16): number[][] {
    const r: number[][] = [];
    for (let i = 0; i < limit; ++i) {
        const c = [];
        for (let j = 0; j < innerLimit; ++j) c.push(AIR);
        r.push(c);
    }
    return r;
}

export function blockStateTensor(chunkRootTag: TagData): number[][][] {
    const r: number[][][] = [];
    for (let x = 0; x < 16; ++x) r.push(emptyX());
    const sections = sortedSections(chunkRootTag) || [];
    sections.forEach( (section, y) => {
        const yy = y * 16;
        const blockData = section.find(x => x.name === "BlockStates");
        const palette = section.find(x => x.name === "Palette");
        if (blockData === undefined || palette === undefined) return [];
        const b = new BlockDataParser(blockData as BlockStates, palette as Palette);
        b.getBlockTypeIDs().forEach( (v, i) => {
            const [ x, y, z ] = chunkCoordinateFromIndex(i);
            r[x][y + yy][z] = v || AIR;
        });
    });
    return r;
}

export function worldHeights(tag: TagData, name: string = "WORLD_SURFACE") : number[][] | undefined {

    if (!isValidChunkRootTag(tag)) return;
    
    const r: number[][] = emptyX(16);
    const map = findChildTagAtPath(`Level/Heightmaps/${name}`, tag);
    if (map === undefined || map.type !== TagType.LONG_ARRAY || !map.data) return;

    const d = new BinaryParser(map.data as ArrayBuffer);
    const b = new BigUint64Array(d.remainingLength() / 8);
    for (let i = 0; i < b.length; ++i) b[i] = d.getUInt64();
    const p = new BitParser(b.buffer);

    for (let i = 0; i < 259; ++i) {
        const ii = i + 6 - 2 * (i % 7);
        const x = ii % 16;
        const z = Math.floor(ii / 16);
        if (i % 7 === 0) p.getBits(1);
        const cc = p.getBits(9);
        if (x < 16 && z < 16) r[x][z] = cc;
    }
    return r;

}

export function biomesAtWorldHeight(tag: TagData, worldHeightName: string = "WORLD_SURFACE"): number[][] | undefined {
    const r = emptyX(4, 4);
    const biomes = findChildTagAtPath("Level/Biomes", tag)?.data as number[];
    const heights = worldHeights(tag, worldHeightName);
    if (biomes === undefined || heights === undefined) return undefined;
    for (let x = 0; x < 4; ++x) {
        for (let z = 0; z < 4; ++z) {
            const biomeIndex = indexFromBiomeCoordinate([ x, Math.floor( heights[x * 4][z * 4] / 4 ), z ]);
            r[x][z] = biomes[biomeIndex];
        }
    }
    return r;
}
