/**
 * @author David Menger
 */
'use strict';


const migrate = require('migrate');

function Migration (title, up, down, description, query) {
    this.title = title;
    this.up = up;
    this.down = down;
    this.description = description;
    this.query = query;
    this.timestamp = null;
}

class MigrationSet extends migrate.MigrationSet {

    constructor (store, query) {
        super(store);

        this.query = query;
    }

    addMigration (title, up, down) {
        let migration;
        if (typeof title === 'object') {
            migration = title;
            migration.query = this.query;
        } else {
            migration = new Migration(title, up, down, null, this.query);
        }

        // Only add the migration once, but update
        if (this.map[migration.title]) {
            this.map[migration.title].up = migration.up;
            this.map[migration.title].down = migration.down;
            this.map[migration.title].description = migration.description;
            return;
        }

        this.migrations.push(migration);
        this.map[migration.title] = migration;
    }

}

module.exports = MigrationSet;
