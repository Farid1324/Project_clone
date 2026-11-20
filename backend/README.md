# Keymarket API

Laravel 13, PHP 8.4, PostgreSQL 18, Sanctum.

Read [backend setup](../docs/backend-setup.md), [API contract](../docs/api-design.md), [schema](../docs/database-schema.md), and the [milestone report](../docs/backend-milestone.md).

This directory is an API application. React will live separately; there is no backend Node build requirement. Use `composer install` from this directory. Generate local secrets only on first setup, then run:

```sh
php artisan migrate
php artisan db:seed
php artisan test --compact
php artisan serve --host=127.0.0.1 --port=8000
```

Database connection values belong in an untracked `.env` copied from `.env.example`. The testing configuration forces the separate `marketplace_testing` database and refuses cached configuration.
