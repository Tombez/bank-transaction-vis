export const binarySearchI = (array, cb) => {
    let min = 0, max = array.length;
    while (max - min > 1) {
        let mid = (max + min) >> 1;
        const dir = cb(array[mid]);
        if (!dir) return mid;
        else if (dir <= 0) max = mid;
        else min = mid;
    }
    return min;
};

export const best = function(array, toScore = a => a, direction = "min") {
    if (!array.length) return null;
    const isBetter = "min" == direction ? (a, b) => a < b : (a, b) => a > b;
    let bestValue = "min" == direction ? Infinity : -Infinity;
    return array.reduce((best, cur) => {
        const curValue = toScore(cur);
        return isBetter(curValue, bestValue) ? 
            (bestValue = curValue, cur) : 
            best;
    }, bestValue);
};

export class Range {
    constructor(min = 0, max = 1) {
        this.min = min;
        this.max = max;
        this.diff = max - min;
    }
    contains(value) {
        return value >= this.min && value <= this.max;
    }
    isEqual(range) {
        return this.min == range.min && this.max == range.max;
    }
    getMidpoint() {
        return this.min + this.diff / 2;
    }
    static fromValues(values) {
        if (!values.length)
            throw new Error('Cannot create Range from no values.');
        return new Range(best(values), best(values, a => a, 'max'));
    }
    static fromRanges(ranges) {
        if (!ranges.length)
            throw new Error('Cannot create Range from no ranges.');
        let min = Infinity;
        let max = -Infinity;
        for (const range of ranges) {
            if (range.min < min) min = range.min;
            if (range.max > max) max = range.max;
        }
        return new Range(min, max);
    }
}

export const capitalize = s => s.at(0).toUpperCase() + s.slice(1).toLowerCase();

const WORD_SIZE = 32;
export class BitArray {
    constructor(length) {
        this.length = length;
        const ArrayType = window[`Uint${WORD_SIZE}Array`];
        this.data = new ArrayType(Math.ceil(length / WORD_SIZE));
    }
    get(index) {
        const wordIndex = index / WORD_SIZE | 0;
        const bitIndex = index % WORD_SIZE;
        return this.data[wordIndex] >> bitIndex & 1;
    }
    set(index, value) {
        const wordIndex = index / WORD_SIZE | 0;
        const bitIndex = index % WORD_SIZE;
        value = value ? 1 : 0;
        const bit = value << bitIndex;
        this.data[wordIndex] = (this.data[wordIndex] & ~bit) | bit;
    }
    clone() {
        let bitArray = new BitArray(0);
        bitArray.length = this.length;
        bitArray.data = this.data.slice();
        return bitArray;
    }
    orEquals(bitArray) {
        const end = Math.min(this.data.length, bitArray.data.length);
        for (let i = 0; i < end; ++i) {
            this.data[i] |= bitArray.data[i];
        }
    }
    static WORD_SIZE = WORD_SIZE;
}

const debounceFuncs = new Set();
export const debounceFunc = (func, cooldown = 100) => {
    if (!debounceFuncs.has(func)) {
        debounceFuncs.add(func);
        window.setTimeout(() => {
            debounceFuncs.delete(func);
            func();
        }, cooldown);
    }
};
