export const dateValToMDY = (n, sep = "/") => {
    const d = new Date(n);
    return d.getMonth() + 1 + sep + d.getDate() + sep + d.getFullYear();
};
export const mdyToDate = (mdy, sep = "/") => {
    let [m,d,y] = mdy.split(sep);
    return new Date(y,m-1,d);
};