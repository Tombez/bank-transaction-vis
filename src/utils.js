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
    static fromValues(values) {
        return new Range(best(values), best(values, a => a, 'max'));
    }
    static fromRanges(ranges) {
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