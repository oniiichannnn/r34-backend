const express = require("express")

const app   = express()
const http  = require('http').createServer(app)
const io    = require('socket.io')(http)

const fetch     = require("node-superfetch")
const fs        = require("fs")
const nodefetch = require("node-fetch")
const colors    = require('colors')
const cors      = require("cors")

const IDs = [ ]
const PORT = process.env.PORT || 4000

app.use( cors() )

app.get("/", ( req , res) => {
    res.send("Hi")
})

app.post("/api/download", ( req , res ) => {
    let ID  = req.body.ID
    let url = req.body.url

    if (IDs.includes(ID)) {
        res.json({
            ID: Date.now() + Math.floor( Math.random() * 1000 ),
            recieved: true
        })
    } else {
        res.json({
            ID: ID,
            recieved: true
        })
    }

    const images        = []
    const newImages     = []

    let beforeCount             = 0
    let fetchedPagesForFetch    = 0
    const maxDownloads          = 0

    const failedDownloads = []
    const failedPages   = []

    const videos = []

    let downloadedImages = 0

    async function getImages ( i ) {
        let fetchURL = url
        if(i !== 0) fetchURL = `${fetchURL}&pid=${42 * i}`

        let body = (await fetch.get(fetchURL)).body.toString()

        if(body.length === 0){

            return false

        } else {
            for(const string of body.split(/ +/g)){
                if(/index.php\?page=post&s=view&id=[0-9]+/.test(string)){
                    images.push(`https://rule34.xxx/${string.replace(/"/g,'').replace("href=","")}`)
                }
            }

            console.log("Fetch Successful".green,fetchURL.gray)
            return true
        }
    }

    async function fetchPage(url,page){
        try {
            let body = (await fetch.get(url)).body.toString()
            let i = 1
        
            for(const arg of body.split(/ +/g)){
                if(
                    /https:\/\/(wimg|us).rule34.xxx\/\/samples\/[0-9]+\/sample_[0-9a-zA-Z]+.(jpg|png|jpeg|webp|gif)\?[0-9]+/.test(arg) ||
                    /https:\/\/(wimg|us).rule34.xxx\/\/images\/[0-9]+\/[0-9a-zA-Z]+.(jpg|png|jpeg|webp|gif)\?[0-9]/.test(arg)
                    ){
                        let URL = arg
                        .replace("href=","")
                        .replace("content=","")
                        .replace("src=","")
                        .replace(/"/g,"")

                        console.log({
                            url: URL,
                            status: "success",
                            page: page
                        })
            

                        newImages.push(URL)

                        if(failedPages.find(page => page.url === URL)){
                            failedPages.splice(
                                failedPages.findIndex(page => page.url === URL) , 1
                            )
                        }
            
                        fetchedPagesForFetch = fetchedPagesForFetch + 1
                        break
                } else

                if(/https:\/\/wwebm.rule34.xxx\/\/images\/[0-9]+\/[0-9a-zA-Z]+.mp4?[0-9]+/.test(arg)) {
                    failedPages.push({
                        url: arg
                        .replace("href=","")
                        .replace("content=","")
                        .replace("src=","")
                        .replace(/"/g,""),
                        status: "failed",
                        reason: "Video link",
                        link: arg
                        .replace("href=","")
                        .replace("content=","")
                        .replace("src=","")
                        .replace(/"/g,"")
                    })

                    videos.push(
                        arg
                        .replace("href=","")
                        .replace("content=","")
                        .replace("src=","")
                        .replace(/"/g,"")
                    )

                    break
                }
        
                i = i + 1
                if(i === body.split(/ +/g).length){
                    if(
                        !failedPages.find(page => page.url === url
                        .replace("href=","")
                        .replace("content=","")
                        .replace("src=","")
                        .replace(/"/g,""))
                    ){
                        failedPages.push({
                            url: url
                            .replace("href=","")
                            .replace("content=","")
                            .replace("src=","")
                            .replace(/"/g,""),
                            status: "failed",
                            reason: "None image links found"
                        })
                    }
                }
            }
        } catch (e) {
            console.log(e)

            if(
                !failedPages.find(page => page.url === url
                .replace("href=","")
                .replace("content=","")
                .replace("src=","")
                .replace(/"/g,""))
            ){
                failedPages.push({
                    url: url
                    .replace("href=","")
                    .replace("content=","")
                    .replace("src=","")
                    .replace(/"/g,""),
                    status: "failed",
                    reason: `${e}`
                })
            }
        }
    }

    if(!/https:\/\/rule34.xxx\/index.php\?page=post&s=list&tags=/.test(url)) return console.log("Invalid URL".red)

    let nextPage = true
    let i = 0

    while(nextPage){
        io.emit("fetching-images", { ID: ID , page: i + 1 , images: images.length } )
        console.log(`Fetching page ${i + 1}, currently found ${images.length} images`.magenta)

        if(beforeCount === images.length && beforeCount !== 0){
            io.emit("fetching-images-done", { ID: ID , success: true })
            console.log("Images did not changed, stopping the loop".green)

            nextPage = false
            break
        } else

        if(images.length >= maxDownloads && maxDownloads !== 0){
            io.emit("fetching-images-done", { ID: ID , success: true })
            console.log(`Reached maximum downloads, stopping the loop`.green)
            break

        } else {
            beforeCount = images.length
            nextPage = await getImages(i)
            i = i + 1
        }
    }

    console.log("Getting images from pages")

    let fetchedPages = 0

    for(const image of images){
        io.emit("fetching-pages", { ID: ID , page: fetchedPages + 1 , pages: images.length })
        console.log(`Fetching pages ${fetchedPages + 1}/${images.length}`)

        await fetchPage(image,fetchedPages)
        fetchedPages = fetchedPages + 1

        if(fetchedPages === maxDownloads && maxDownloads !== 0){
            console.log("Reached maximum downloads, stoping fetch")
            
            break
        }
    }

    console.log("Done")

    const Data = {
        ID: ID,
        images: newImages
    }
    
    io.emit("downloaded", Data )
    IDs.splice( IDs.indexOf(ID) , 1 )
})

io.on('connection', socket => {
    console.log("user connected")
})

app.listen(PORT, () => {
    console.log("Backend is online")
})