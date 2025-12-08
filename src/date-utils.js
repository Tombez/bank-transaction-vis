export const dateValToMdy = (n, sep) => {
    const date = new Date(n);
    return dateToMdy(date, sep);
};
export const dateToMdy = (d, sep = "/") => {
    return (d.getMonth() + 1) + sep + d.getDate() + sep + d.getFullYear();
};
export const dateToYmd = (d, sep = "/", pad = true) => {
    const month = (d.getMonth() + 1).toString().padStart(2, "0");
    const day = d.getDate().toString().padStart(2, "0");
    return d.getFullYear() + sep + month + sep + day;
};
export const mdyToDate = (mdy, sep = "/") => {
    let [m,d,y] = mdy.split(sep);
    return new Date(y,m-1,d);
};
export const fromYmdToMdy = (text, sep = "/") => {
    const separator = text.match(/[^\d]/);
    const [y, m, d] = text.split(separator);
    return `${m}${sep}${d}${sep}${y}`;
};
export const padYearMdy = (mdy, millenium = "20") => {
    if (!mdy) return mdy;
    const separatorMatch = mdy.match(/[^\d]/);
    if (!separatorMatch) {
        throw new Error(`no separator in date string: '${mdy}'`);
    }
    const separator = separatorMatch[0];
    let [m, d, y] = mdy.split(separator);
    if (y.length == 2) {
        y = millenium + y;
        throw new Error("found two-digit year");
    } else if (y.length != 4)
        throw new Error(`year portion of date is not 2 or 4 characters: ${y}`);
    return `${m}${separator}${d}${separator}${y}`;
};
export const nowString = () => {
    const now = new Date();
    const millis = now % (1000 * 60 * 60 * 24);
    return dateValToMdy(now, "-") + "-" + millis;
};