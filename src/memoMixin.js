const memoMixin = (mixin) => {
    const baseMap = new Map();
    return (Base = Object) => {
        let existingMixin = baseMap.get(Base);
        if (!existingMixin) {
            existingMixin = mixin(Base);
            baseMap.set(Base, existingMixin);
        }
        return existingMixin;
    };
};
export default memoMixin;