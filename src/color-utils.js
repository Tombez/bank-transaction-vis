export const hsl = (h, s=1, l=0.5) => ({
    h: h, s: s, l: l, toString:
        function(){return `hsl(${this.h*360|0},${this.s*100|0}%,${this.l*100|0}%)`}
});
export class Color {
    constructor(r = Math.random(), g = Math.random(), b = Math.random()) {
        this.r = r;
        this.g = g;
        this.b = b;
    }
    toString() {
        return `rgb(${this.r * 256 | 0}, ${this.g * 256 | 0}, ${this.b * 256 | 0})`;
    }
    length() {
        return Math.hypot(this.r, this.g, this.b);
    }
    add(c) {
        this.r += c.r;
        this.g += c.g;
        this.b += c.b;
        return this;
    }
    diff(c) {
        if (!c) debugger;
        return new Color(this.r - c.r, this.g - c.g, this.b - c.b);
    }
    dist(c) {
        return this.diff(c).length();
    }
    normalize() {
        const len = this.length();
        this.r /= len;
        this.g /= len;
        this.b /= len;
        return this;
    }
    scale(n) {
        this.r *= n;
        this.g *= n;
        this.b *= n;
        return this;
    }
    clamp(min = 0, max = 1) {
        this.r = Math.max(Math.min(this.r, max), min);
        this.g = Math.max(Math.min(this.g, max), min);
        this.b = Math.max(Math.min(this.b, max), min);
        return this;
    }
}