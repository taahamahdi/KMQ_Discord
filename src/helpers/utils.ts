import fs from "fs";
import { exec } from "child_process";
import _logger from "../logger";

const logger = _logger("game_session");

/**
 * Promise-based delay function
 * @param delayDuration - Delay in milliseconds
 */
export function delay(delayDuration: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, delayDuration));
}

/**
 * @param text - Text to bold
 * @returns bolded text
 */
export function bold(text: string): string {
    return `**${text}**`;
}

/**
 * @param text - Text to italicize
 * @returns italicized text
 */
export function italicize(text: string): string {
    return `*${text}*`;
}

/**
 * @param text - Text to codify
 * @returns codified text
 */
export function codeLine(text: string): string {
    return `\`${text}\``;
}

/**
 * @param num - The number to round
 * @param places - The number of places to round
 * @returns the rounded number
 */
export function roundDecimal(num: number, places: number) {
    return Math.round(num * (10 ** places)) / (10 ** places);
}

/**
 * Chunks in an array in subarrays of specified size
 * @param array - The input array
 * @param chunkSize - The size of each chunked array
 */
export function chunkArray<T>(array: Array<T>, chunkSize: number): Array<Array<T>> {
    const chunkedArrays = [];
    for (let i = 0; i < array.length; i += chunkSize) {
        const embedFieldsSubset = array.slice(i, Math.min(i + chunkSize, array.length));
        chunkedArrays.push(embedFieldsSubset);
    }
    return chunkedArrays;
}

/**
 * @param songPath - the file path of the song file
 * @returns the audio duration of the song
 */
export function getAudioDurationInSeconds(songPath: string): Promise<number> {
    return new Promise((resolve) => {
        exec(`ffprobe -i "${songPath}" -show_entries format=duration -v quiet -of csv="p=0"`, (err, stdout, stderr) => {
            if (!stdout || stderr) {
                logger.error(`Error getting audio duration: path = ${songPath}, err = ${stderr}`);
                resolve(0);
                return;
            }
            resolve(parseInt(stdout, 10));
        });
    });
}

/**
 * @param filePath - the file path of the JSON file
 * @returns a Javascript object representation of the file
 */
export function parseJsonFile(filePath: string) {
    return JSON.parse(fs.readFileSync(filePath).toString());
}

/**
 * @param arr - The input array of strings
 * @returns a proper comma+'and' separated string
 */
export function arrayToString(arr: Array<string>): string {
    const elements = arr.map((element) => `\`${element}\``);
    if (elements.length === 1) return elements[0];
    const lastElement = elements.splice(-1);
    return `${elements.join(", ")} and ${lastElement}`;
}

/**
 * Stolen from https://weeknumber.net/how-to/javascript
 * @returns the current ISO week number in the year, ranges from 1-52 (53 on certain years)
 */
export function weekOfYear(dateObj?: Date): number {
    const date = dateObj || new Date();
    date.setHours(0, 0, 0, 0);
    // Thursday in current week decides the year.
    date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
    // January 4 is always in week 1.
    const week1 = new Date(date.getFullYear(), 0, 4);
    // Adjust to Thursday in week 1 and count number of weeks from date to week1.
    return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}

/**
 * Chooses random element from a list
 * @param list List of arbitrary elements
 */
export function chooseRandom(list: Array<any>) {
    return list[Math.floor(Math.random() * list.length)] || [];
}
