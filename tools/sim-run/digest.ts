import { writeFileSync } from "node:fs";
import { matrixCases, matrixDigest, runCase } from "../../client/determinism/matrix";
import { gameData } from "../../sim/testing/game-data";

// Prints the digest of the determinism matrix (client/determinism/matrix.ts) in Node;
// with a path it also writes every case's checkpoints there as JSON, to compare two builds.
const data = gameData();
const results = matrixCases(data).map((c) => runCase(data, c));
console.log(matrixDigest(results));
const out = process.argv[2];
if (out !== undefined) writeFileSync(out, JSON.stringify(results));
