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
}

export const capitalize = s => s.at(0).toUpperCase() + s.slice(1).toLowerCase();