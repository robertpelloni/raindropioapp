/*
    Browsers sometime block localStorage due to some settings
    In this case we not want for app to crash
*/
let mock = {}

export default {
    getItem(key) {
        try{
            return localStorage.getItem(key)
        } catch(e) {
            return mock[key] || null
        }
    },
    setItem(key, val) {
        try{
            return localStorage.setItem(key, val)
        } catch(e) {
            mock[key] = String(val)
        }
    },
    removeItem(key) {
        try{
            return localStorage.removeItem(key)
        } catch(e) {
            delete mock[key]
        }
    },
    clear() {
        try{
            return localStorage.clear()
        } catch(e) {
            mock = {}
        }
    }
}