const memoMixin = (Mixin) => {
    const baseMap = new Map();
    return (Base = Object) => {
        let existingMixin = baseMap.get(Base);
        if (!existingMixin) {
            existingMixin = Mixin(Base);
            baseMap.set(Base, existingMixin);
        }
        return existingMixin;
    };
};
export default memoMixin;