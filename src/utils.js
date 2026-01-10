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