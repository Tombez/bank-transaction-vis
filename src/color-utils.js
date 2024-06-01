export const hsl = (h, s=1, l=0.5) => ({
    h: h, s: s, l: l, toString:
        function(){return `hsl(${this.h*360|0},${this.s*100|0}%,${this.l*100|0}%)`}
});
