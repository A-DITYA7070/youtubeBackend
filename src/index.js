import dotenv from "dotenv";
dotenv.config({path:'./env'});

import connectDB from "./db/index.js";
import {app} from "./app.js"

connectDB()
.then(()=>{
    app.listen(process.env.PORT || 4500, ()=> {
        console.log(` Server is running at port : ${process.env.PORT}`)
    })
})
.catch((err)=>{
    console.log("Mongo db connection failed !!! ",err)
})

