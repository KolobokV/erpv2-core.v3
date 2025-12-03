<?php
error_reporting(E_ALL & ~E_NOTICE);
ini_set("display_errors", 1);

require_once "/var/www/html/master.inc.php";
require_once DOL_DOCUMENT_ROOT."/core/lib/admin.lib.php";
require_once DOL_DOCUMENT_ROOT."/user/class/user.class.php";

global $db;

$db->begin();

// Включаем ключевые модули константами
$mods = array(
  "MAIN_MODULE_SOCIETE",  // Third parties
  "MAIN_MODULE_PRODUCT",  // Products/Services
  "MAIN_MODULE_FACTURE",  // Invoices/Billing
  "MAIN_MODULE_PROJET",   // Projects/Tasks
  "MAIN_MODULE_BANQUE",   // Bank/Cash
  "MAIN_MODULE_STOCK",    // Stock
  "MAIN_MODULE_API"       // API
);

foreach ($mods as $c) {
    dolibarr_set_const($db, $c, "1", "chaine", 0, "", 1);
}

// Гарантируем, что админ — действительно админ
$login = getenv("DOLI_ADMIN_LOGIN");
if (!$login || $login === "") $login = "admin";
$u = new User($db);
if ($u->fetch("", $login) > 0) {
    $u->admin = 1;
    $u->update($u, 1);
}

$db->commit();
echo "OK";
