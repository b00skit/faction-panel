<?php

namespace App\Console\Commands;

use App\Models\StatisticsWidget;
use App\Services\StatisticsService;
use Illuminate\Console\Command;

class RefreshStatistics extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'statistics:refresh';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Recalculates cached results for all statistics widgets';

    /**
     * Execute the console command.
     */
    public function handle(StatisticsService $statisticsService): int
    {
        $this->info('Starting statistics refresh...');

        $widgets = StatisticsWidget::all();
        $count = $widgets->count();

        $this->info("Found {$count} widget(s) to process.");

        $bar = $this->output->createProgressBar($count);
        $bar->start();

        foreach ($widgets as $widget) {
            try {
                $statisticsService->calculate($widget, true);
            } catch (\Throwable $e) {
                $this->error("\nFailed to calculate widget {$widget->id} ({$widget->name}): ".$e->getMessage());
            }
            $bar->advance();
        }

        $bar->finish();
        $this->newLine();
        $this->info('Statistics refresh completed successfully!');

        return Command::SUCCESS;
    }
}
