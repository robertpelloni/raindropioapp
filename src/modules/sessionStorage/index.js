/*
    Browsers sometime block sessionStorage due to some settings
    In this case we not want for app to crash
*/
let mock = {}

export default {
    getItem(key) {
        try{
            return sessionStorage.getItem(key)
        } catch(e) {
            return mock[key] || null
        }
    },
    setItem(key, val) {
        try{
            return sessionStorage.setItem(key, val)
        } catch(e) {
            mock[key] = String(val)
        }
    },
    removeItem(key) {
        try{
            return sessionStorage.removeItem(key)
        } catch(e) {
            delete mock[key]
        }
    },
    clear() {
        try{
            return sessionStorage.clear()
        } catch(e) {
            mock = {}
        }
    }
}