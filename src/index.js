import express from 'express'
import bodyParser from 'body-parser'
import dotenv from 'dotenv'

import { createAssistant, chatAI } from './assistant'
import { executeSqlQuery, getSchemaInformation } from './databseSchema'
;(async function() {
    /**
     * load environment variables from .env
     */
    dotenv.config()

    /**
     * initiate the express server instance
     */
    const app = express()

    /**
     * enable cors for express app
     */
    const cors = require('cors')({
        origin: true,
    })

    app.use(cors)

    /**
     * parse the form data from body using body parser
     */
    app.use(
        bodyParser.urlencoded({
            extended: true,
        })
    )

    /**
     * parse the json from body using body parser
     */
    app.use(
        bodyParser.json({
            limit: '100mb',
        })
    )

    /**
     * get express port from .env
     * or declare with default value
     */
    const port = process.env.PORT || 3000

    app.post('/ask', async (req, res) => {
        try {
            const { question } = req.body
            const schema = await getSchemaInformation()

            // // Use OpenAI Assistant to generate a response
            const openaiResponse = await chatAI({
                question,
                assistantId: 'asst_zFjBNeScYT4mLgJfzVKqhKsb',
                // assistantId: 'asst_tNkeXJfjCaFq38uYkJQxnEBX', // gpt-4-turbo-preview
                schema,
            })

            // Execute SQL query based on the generated response
            // let data = []
            // if (openaiResponse?.query) {
            //     data = await executeSqlQuery(openaiResponse?.query)
            // }

            res.json({
                ...openaiResponse,
                // data,
                // sqlResults
            })
        } catch (error) {
            console.error('Error handling request:', error.message)
            res.status(500).json({ error: 'Internal Server Error' })
        }
    })

    /**
     * listen to the exposed port
     */
    app.listen(port, () => {
        // eslint-disable-next-line
        console.log('App server started on port ' + port)
    })
})()
