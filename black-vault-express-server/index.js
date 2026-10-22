const express = require('express')

const app = express()
const port = 8000

app.get('/', (req, res)=>{
    res.send('Hola! Soy la raíz ;)')
})

app.listen(port, ()=>{
    console.log(`Server is runing at http:localhost:${port}`)
})