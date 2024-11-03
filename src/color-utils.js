export const hsl = (h, s=1, l=0.5) => ({
    h: h, s: s, l: l, toString:
        function(){return `hsl(${this.h*360|0},${this.s*100|0}%,${this.l*100|0}%)`}
});
export const Color = (r = Math.random(), g = Math.random(), b = Math.random()) => ({
    r, g, b,
    toString: function() {
        return `rgb(${this.r * 256 | 0}, ${this.g * 256 | 0}, ${this.b * 256 | 0})`;
    },
    length: function() {
        return Math.hypot(this.r, this.g, this.b);
    },
    add: function(c) {
        this.r += c.r;
        this.g += c.g;
        this.b += c.b;
        return this;
    },
    diff: function (c) {
        return Color(this.r - c.r, this.g - c.g, this.b - c.b);
    },
    dist: function(c) {
        return this.diff(c).length();
    },
    normalize: function() {
        const len = this.length();
        this.r /= len;
        this.g /= len;
        this.b /= len;
        return this;
    },
    scale: function(n) {
        this.r *= n;
        this.g *= n;
        this.b *= n;
        return this;
    },
    clamp(min = 0, max = 1) {
        this.r = Math.max(Math.min(this.r, max), min);
        this.g = Math.max(Math.min(this.g, max), min);
        this.b = Math.max(Math.min(this.b, max), min);
        return this;
    }
});