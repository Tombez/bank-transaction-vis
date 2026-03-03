export const MS_DAY = 1000 * 60 * 60 * 24;
export const MS_WEEK = MS_DAY * 7;

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
const ymdRegex = /^(?<y>\d{4})(?<sep>[^\d])(?<m>\d\d?)\2(?<d>\d\d?)$/;
const mdyRegex = /^(?<m>\d\d?)(?<sep>[^\d])(?<d>\d\d?)\2(?<y>\d{4})$/;
const ymdRegexNoCap = /^\d{4}[^\d]\d\d?[^\d]\d\d?$/;
const mdyRegexNoCap = /^\d\d?[^\d]\d\d?[^\d]\d{4}$/;
export const isDateNumerical = s => ymdRegex.exec(s) || mdyRegex.exec(s);
const writtenDateRegex = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec) \d\d? \d\d\d\d$/i;
export const isDateWritten = s => writtenDateRegex.test(s);
// export const isDateStr = s => isDateNumerical(s) || isDateWritten(s);
const isDigit = code => code >= 48 && code <= 57;
export const isDateStr = s => {
    if (s.length > 11) return false;
    return isDigit(s.charCodeAt(0)) ?
        ymdRegexNoCap.test(s) || mdyRegexNoCap.test(s) :
        isDateWritten(s);
};
export const isYmd = str => /^\d{4}/.test(str);
export const fromDateString = (dateStr) => {
    if (isDateWritten(dateStr)) return new Date(dateStr);
    const match = isDateNumerical(dateStr);
    if (match) {
        const {y, m, d} = match.groups;
        return new Date(y, m-1, d);
    }
    throw new Error(`'${dateStr}' is not a recognized date format.`);
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
    const nowDate = new Date();
    const millis = nowDate.getTime() % MS_DAY;
    return dateValToMdy(now, "-") + "-" + millis;
};
export const getWeek = (date) => {
    if (typeof date == 'number') date = new Date(date);
    const day = date.getDate() - date.getDay();
    const weekBegin = new Date(date.getFullYear(), date.getMonth(), day);
    return weekBegin.getTime() / MS_WEEK | 0;
};