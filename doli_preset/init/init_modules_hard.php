<?php
error_reporting(E_ALL & ~E_NOTICE);
ini_set("display_errors", 1);

require_once "/var/www/html/master.inc.php";

// Загружаем через dol_include_once — он использует DOL_DOCUMENT_ROOT/htdocs корректно
dol_include_once("core/class/modules.class.php");
dol_include_once("core/modules/modSociete.class.php");  // Third parties
dol_include_once("core/modules/modProduct.class.php");  // Products/Services
dol_include_once("core/modules/modFacture.class.php");  // Invoices
dol_include_once("core/modules/modProjet.class.php");   // Projects/Tasks
dol_include_once("core/modules/modBanque.class.php");   // Bank/Cash
dol_include_once("core/modules/modStock.class.php");    // Stock
dol_include_once("core/modules/modApi.class.php");      // REST API

global $db;

$mods = array(
    new modSociete($db),
    new modProduct($db),
    new modFacture($db),
    new modProjet($db),
    new modBanque($db),
    new modStock($db),
    new modApi($db)
);

foreach ($mods as $m) {
    if (!method_exists($m, "init")) {
        echo "ERR: ".get_class($m)." has no init()\n";
        exit(2);
    }
    $res = $m->init(1); // активация: создаёт константы/права/меню
    if ($res < 0) {
        echo "ERR: init ".get_class($m)." -> ".$m->error."\n";
        exit(3);
    }
}

echo "OK: modules initialized\n";
