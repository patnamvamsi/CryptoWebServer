# TimescaleDB Setup Guide

## Current Status
Django is now configured to use TimescaleDB instead of SQLite. You need to ensure TimescaleDB is running and accessible.

## Option 1: Use Existing TimescaleDB Instance

If you already have TimescaleDB running (e.g., from the CryptoMarketData microservice), update your `.env` file with the correct credentials:

```bash
# TimescaleDB Configuration
TIMESCALE_HOST=localhost          # or your TimescaleDB server IP
TIMESCALE_PORT=5432              # Default PostgreSQL port
TIMESCALE_DB=market_data         # Database name
TIMESCALE_USER=postgres          # Your PostgreSQL username
TIMESCALE_PASSWORD=your_password # Your actual PostgreSQL password
```

Then run migrations:
```bash
python manage.py migrate
```

## Option 2: Install TimescaleDB with Docker (Recommended)

If you don't have TimescaleDB running, the easiest way is using Docker:

```bash
# Pull and run TimescaleDB
docker run -d --name timescaledb \
  -p 5432:5432 \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=market_data_dev1 \
  timescale/timescaledb:latest-pg16

# Wait a few seconds for the database to start
sleep 5

# Verify it's running
docker ps | grep timescaledb
```

Then update your `.env`:
```bash
TIMESCALE_HOST=localhost
TIMESCALE_PORT=5432
TIMESCALE_DB=market_data_dev1
TIMESCALE_USER=postgres
TIMESCALE_PASSWORD=postgres
```

Then run migrations:
```bash
python manage.py migrate
```

## Option 3: Install TimescaleDB Natively

### On Ubuntu/Debian:
```bash
# Add TimescaleDB repository
sudo sh -c "echo 'deb https://packagecloud.io/timescale/timescaledb/ubuntu/ $(lsb_release -c -s) main' > /etc/apt/sources.list.d/timescaledb.list"
wget --quiet -O - https://packagecloud.io/timescale/timescaledb/gpgkey | sudo apt-key add -

# Install TimescaleDB
sudo apt-get update
sudo apt-get install timescaledb-2-postgresql-16

# Initialize and start PostgreSQL
sudo systemctl enable postgresql
sudo systemctl start postgresql

# Create database and user
sudo -u postgres psql -c "CREATE DATABASE market_data;"
sudo -u postgres psql -c "CREATE USER postgres WITH PASSWORD 'postgres';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE market_data TO postgres;"
sudo -u postgres psql -d market_data -c "CREATE EXTENSION IF NOT EXISTS timescaledb;"
```

### On macOS:
```bash
# Using Homebrew
brew install timescaledb

# Follow post-install instructions, then:
createdb market_data
psql -d market_data -c "CREATE EXTENSION IF NOT EXISTS timescaledb;"
```

## Verify Connection

Test that Django can connect:
```bash
python manage.py check --database default
python manage.py showmigrations
```

## Run Migrations

Once connected, create all Django tables in TimescaleDB:
```bash
python manage.py migrate
```

This will create:
- Django auth tables (User, Group, Permission)
- Session tables
- Admin tables
- Your BacktestJob model table
- Any other Django tables

## Create Superuser

After migrations, create an admin user:
```bash
python manage.py createsuperuser
```

## Troubleshooting

### Error: "password authentication failed"
- Check that TIMESCALE_PASSWORD in `.env` matches your PostgreSQL password
- Try connecting manually: `psql -h localhost -U postgres -d market_data`

### Error: "database does not exist"
- Create the database: `psql -U postgres -c "CREATE DATABASE market_data;"`

### Error: "role does not exist"
- Create the user: `psql -U postgres -c "CREATE USER postgres WITH PASSWORD 'postgres';"`

### Error: "connection refused"
- Ensure PostgreSQL/TimescaleDB is running: `sudo systemctl status postgresql` (Linux) or `brew services list` (macOS)
- Check if port 5432 is open: `sudo netstat -tlnp | grep 5432`

## Rollback to SQLite (if needed)

If you want to temporarily revert to SQLite, edit `CryptoWebServer/settings.py`:

```python
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': os.path.join(BASE_DIR, 'db.sqlite3'),
    }
}
```
