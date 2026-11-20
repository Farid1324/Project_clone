<?php

namespace Tests\Feature;

// use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExampleTest extends TestCase
{
    /**
     * A basic test example.
     */
    public function test_the_application_returns_a_successful_response(): void
    {
        config(['marketplace.spa_index' => storage_path('framework/no-frontend-build.html')]);
        $response = $this->get('/');

        $response->assertStatus(200)->assertJsonPath('service', 'Keymarket API');
    }
}
