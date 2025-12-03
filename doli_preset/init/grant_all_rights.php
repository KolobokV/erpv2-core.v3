<?php
error_reporting(E_ALL & ~E_NOTICE);
ini_set("display_errors", 1);

require_once "/var/www/html/master.inc.php";
require_once DOL_DOCUMENT_ROOT."/core/lib/admin.lib.php"; // <-- нужно для dolibarr_set_const()

global $db;

// 1) Логин администратора
$login = getenv("DOLI_ADMIN_LOGIN");
if (!$login || $login==="") $login = "admin";

// 2) rowid админа
$sql = "SELECT rowid FROM ".MAIN_DB_PREFIX."user WHERE login='".$db->escape($login)."'";
$res = $db->query($sql);
if(!$res || $db->num_rows($res)==0){ echo "ERROR: admin user not found\n"; exit(2); }
$uid = (int)$db->fetch_object($res)->rowid;

// 3) Выдать ВСЕ права из llx_rights_def
$sql = "INSERT INTO ".MAIN_DB_PREFIX."user_rights (fk_user, fk_id)
        SELECT ".$uid.", r.id
        FROM ".MAIN_DB_PREFIX."rights_def r
        LEFT JOIN ".MAIN_DB_PREFIX."user_rights ur
          ON ur.fk_id = r.id AND ur.fk_user = ".$uid."
        WHERE ur.rowid IS NULL";
if(!$db->query($sql)){ echo "ERROR: cannot grant rights: ".$db->lasterror()."\n"; exit(3); }

// 4) Включить ключевые модули константами
foreach ([
  "MAIN_MODULE_SOCIETE",
  "MAIN_MODULE_PRODUCT",
  "MAIN_MODULE_FACTURE",
  "MAIN_MODULE_PROJET",
  "MAIN_MODULE_BANQUE",
  "MAIN_MODULE_STOCK",
  "MAIN_MODULE_API"
] as $c) { dolibarr_set_const($db, $c, "1", "chaine", 0, "", 1); }

// 5) Убедиться, что admin=1
$db->query("UPDATE ".MAIN_DB_PREFIX."user SET admin=1 WHERE rowid=".$uid);

// 6) Итог: сколько прав у админа
$res = $db->query("SELECT COUNT(*) c FROM ".MAIN_DB_PREFIX."user_rights WHERE fk_user=".$uid);
$o = $db->fetch_object($res);
echo "OK: rights_granted=".($o?$o->c:0)."\n";
