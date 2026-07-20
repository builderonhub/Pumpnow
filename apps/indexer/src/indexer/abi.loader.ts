import { Injectable } from "@nestjs/common";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Abi } from "viem";

@Injectable()
export class AbiLoader {
  load(name: "PumpFactory" | "PumpPair" | "Treasury"): Abi {
    const relative = join("contracts", "abi", `${name}.json`);
    const candidates = [
      resolve(process.cwd(), relative),
      resolve(process.cwd(), "..", "..", relative),
    ];
    const path = candidates.find((candidate) => existsSync(candidate));
    if (!path) throw new Error(`Exported ABI not found: ${relative}`);

    const value: unknown = JSON.parse(readFileSync(path, "utf8"));
    if (!Array.isArray(value)) throw new Error(`Invalid ABI JSON: ${path}`);
    return value as Abi;
  }
}
