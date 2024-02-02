import dotenv from 'dotenv'
import OpenAI from 'openai'
import { executeSqlQuery } from './databseSchema'
/**
 * load environment variables from .env
 */
dotenv.config()

const openaiApiKey = process.env.OPENAI_API_KEY
const client = new OpenAI({
    apiKey: openaiApiKey,
})

async function chatAI({
    question = '',
    schema = {},
    assistantId = null,
    model = 'gpt-3.5-turbo-1106',
}) {
    const messages = [
        {
            role: 'system',
            content:
                'You are a SQL expert. User asks you questions about the Postgres database. First obtain the schema of the database to check the tables and columns. The database has a table named "buildings" with fields like "buildindId" (alias: "id"), "name" (alias: "dis"), "area", campusName, division,  "address" (alias: "geoAddr"), "city" (alias: "geoCity") etc. Use this information to interpret user questions and generate accurate SQL queries',
        },
        {
            role: 'user',
            content: question,
        },
        {
            role: 'assistant',
            content: `Here is the schema information: ${JSON.stringify(
                schema
            )}`,
        },
    ]
    let threadId = null
    let runId = null
    let query = ''
    let data = []
    try {
        // await cancelRun(
        //     'thread_uSKU4iOvdVWsusaUvsNIJaG9',
        //     'run_GtxwwwUgL8W5X9eolKg7zV0q'
        // )
        // return
        const thread = await client.beta.threads.create()
        console.log(thread, 'thread')
        threadId = thread?.id

        const message = await client.beta.threads.messages.create(thread.id, {
            role: 'user',
            content: question,
        })
        console.log(message, 'message')

        const run = await client.beta.threads.runs.create(thread.id, {
            assistant_id: assistantId,
            instructions:
                "You are a Senior SQL expert. Users will ask questions about the PostgreSQL database, and it's your task to translate them into the perfect SQL queries. First obtain the schema of the database to check the tables, columns and foreign relations. FYI, 'dis' stores names/titles and discard null values in the Postgres database. Use this information to interpret user questions and generate precise SQL queries and run sql query on posgress database for better answer.",
        })
        runId = run?.id
        console.log(run, 'run')

        while (run?.status !== 'completed') {
            const runStatus = await client.beta.threads.runs.retrieve(
                thread.id,
                run.id
            )
            console.log(runStatus, 'runStatus')

            if (runStatus?.status === 'requires_action') {
                const toolCalls =
                    runStatus?.required_action?.submit_tool_outputs?.tool_calls
                console.log(toolCalls, 'toolCalls')
                if (toolCalls?.length) {
                    const toolOutputs = []
                    for (let i = 0; i < toolCalls.length; i++) {
                        const toolCall = toolCalls[i]
                        let output = ''
                        console.log(toolCall, toolCall.function?.arguments)
                        if (toolCall.function?.name === 'get_db_schema') {
                            output = JSON.stringify(schema)
                        } else {
                            output =
                                JSON.parse(toolCall.function?.arguments)
                                    ?.query || ''
                            output = addQuotesAroundCamelCase(output)
                            console.log('here 1')
                            if (output) {
                                console.log('here 2', output)
                                query = output
                                data = await executeSqlQuery(query)
                                console.log('here 3', data)
                                output = data
                                    .map((result) => JSON.stringify(result))
                                    .join('\n')
                                console.log('here 3', output)
                            }
                        }

                        toolOutputs.push({
                            tool_call_id: toolCall?.id,
                            output,
                        })
                    }

                    const submitToolOutputs = await client.beta.threads.runs.submitToolOutputs(
                        thread.id,
                        run.id,
                        {
                            tool_outputs: toolOutputs,
                        }
                    )
                    console.log(submitToolOutputs, 'submitToolOutputs')
                }
                console.log(
                    runStatus,
                    'runStatus requires_action',
                    thread?.id,
                    run?.id
                )
                // await cancelRun(thread?.id, run?.id)
                // break
            }

            if (runStatus?.status === 'completed') {
                break
            }
        }

        const response = await client.beta.threads.messages.list(thread.id)

        console.log(response, 'response')

        return {
            message:
                response?.data?.[0]?.content?.[0]?.text?.value ||
                'No Data Found',
            query,
            data,
        }
        // Process the assistant's response
    } catch (error) {
        console.log(threadId, runId, error, 'error')
        await cancelRun(threadId, runId)
        return {
            message: 'Currently, we are unable to process this request.',
        }
        // Handle errors
    }
}

const cancelRun = async (threadId, runId) => {
    const cancel = await client.beta.threads.runs.cancel(threadId, runId)
    console.log(cancel, 'cancelRun')
}

const addQuotesAroundCamelCase = (query) => {
    query = query.replace(/\n/g, ' ')

    // Define a regular expression pattern to match words after a dot (.)
    const dotPattern = /\.(\w+)/g

    // Add double quotes around words after a dot (.)
    let modifiedQuery = query
    // .replace(dotPattern, '."$1"')

    // Define a regular expression pattern to match camel case words
    const camelCasePattern = /\b([a-z][a-zA-Z0-9]*)\b/g

    // Add double quotes around camel case words
    modifiedQuery = modifiedQuery.replace(camelCasePattern, '"$1"')

    // Check if the query contains 'LIMIT'; if not, add 'LIMIT 100;'
    if (!modifiedQuery.toLowerCase().includes('limit')) {
        modifiedQuery = modifiedQuery.replace(/;/g, '') + ' LIMIT 100;'
    }

    return modifiedQuery
}

const createAssistant = async (question) => {
    const assistant = await client.beta.assistants.create({
        name: 'AI Assistant gpt-4-turbo-preview',
        description:
            'AI assistant responsible for crawling DataBase and finding insights',
        instructions: `
        You are a SQL expert. User asks you questions about the Postgres database. First obtain the schema of the database to check the tables, columns and foreign relations. Always treat dis field as name, discard null values. Use this information to interpret user questions and generate accurate SQL queries and run sql query on posgress database for better answer.
      `,
        model: 'gpt-4-turbo-preview',
        tools: [
            {
                type: 'function',
                function: {
                    name: 'get_db_schema',
                    description: 'Get the schema of the database',
                    parameters: {
                        type: 'object',
                        properties: {},
                        required: [],
                    },
                },
            },
            {
                type: 'function',
                function: {
                    name: 'run_sql_query',
                    description: 'Run a SQL query on the database',
                    parameters: {
                        type: 'object',
                        properties: {
                            query: {
                                type: 'string',
                                description: 'The SQL query to run',
                            },
                        },
                        required: ['query'],
                    },
                },
            },
            {
                type: 'code_interpreter',
            },
        ],
        file_ids: [],
    })

    // asst_zFjBNeScYT4mLgJfzVKqhKsb
    // const assistant = await assistant()
    // if(assistant?.id) {
    //     return assistant?.id
    // }

    return null
}

// createAssistant()
//   .then(assistant => console.log(assistant.id))
//   .catch(error => console.error(error));

module.exports = { createAssistant, chatAI }
