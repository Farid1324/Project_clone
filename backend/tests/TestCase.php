<?php

namespace Tests;

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    public function createApplication(): Application
    {
        $app = parent::createApplication();
        if ($app->configurationIsCached() || config('database.default') !== 'pgsql' || config('database.connections.pgsql.database') !== 'marketplace_testing') {
            throw new \LogicException('Tests require uncached configuration and the dedicated marketplace_testing PostgreSQL database.');
        }

        return $app;
    }
}
