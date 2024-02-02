import Sequelize from 'sequelize'
const database = require('./config/database')

const sequelize = new Sequelize(
    database.database,
    database.username,
    database.password,
    database
)

const executeSqlQuery = async (query) => {
    try {
        const results = await sequelize.query(query, {
            type: Sequelize.QueryTypes.SELECT,
        })

        return results
    } catch (error) {
        console.error('Error executing SQL query:', error.message)
        return []
    }
}

const getSchemaInformation = async () => {
    const tables = await sequelize.getQueryInterface().showAllTables()
    const schema = {}

    for (const table of tables) {
        if (
            ![
                'SequelizeMeta',
                'views',
                'notifications',
                'messages',
                'conversations',
                'bookmarks',
                'logs',
            ]?.includes(table)
        ) {
            // Get columns and foreign keys
            const [columns, foreignKeys] = await Promise.all([
                sequelize.query(
                    `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = 'public' and table_name = '${table}'`
                ),
                sequelize.query(
                    `SELECT
            tc.constraint_name, tc.table_name, kcu.column_name, ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name
          FROM information_schema.table_constraints AS tc
          JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
          JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
          WHERE constraint_type = 'FOREIGN KEY' AND tc.table_name = '${table}'`
                ),
            ])

            schema[table] = {
                columns: columns[0],
                foreignKeys: foreignKeys[0].map((row) => ({
                    constraintName: row.constraint_name,
                    columnName: row.column_name,
                    foreignTableName: row.foreign_table_name,
                    foreignColumnName: row.foreign_column_name,
                })),
            }
        }
    }

    return schema
}

module.exports = { executeSqlQuery, getSchemaInformation }
