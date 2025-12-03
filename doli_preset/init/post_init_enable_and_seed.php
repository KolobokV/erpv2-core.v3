<?php
error_reporting(E_ALL & ~E_NOTICE);
ini_set("display_errors", 1);

$customInitDir = "/var/www/html/custom/init";
$apiKeyFile    = $customInitDir . "/api_key.txt";

require_once "/var/www/html/master.inc.php";
require_once DOL_DOCUMENT_ROOT."/core/lib/admin.lib.php";

global $db, $conf, $langs;
$langs->load("main");

function out($m){ echo $m.PHP_EOL; }

dol_include_once("/user/class/user.class.php");

function fetch_user_by_login($db, $login){
    $u = new User($db);
    return ($u->fetch("", $login) > 0) ? $u : null;
}
function create_admin_user($db, $login, $pass){
    $u = new User($db);
    $u->login = $login;
    $u->lastname = "Admin";
    $u->firstname = "Super";
    $u->admin = 1;
    $u->pass = $pass;
    return ($u->create(null) > 0) ? $u : null;
}
function fetch_first_user($db){
    $sql = "SELECT rowid FROM ".MAIN_DB_PREFIX."user ORDER BY rowid ASC LIMIT 1";
    $res = $db->query($sql);
    if ($res && $db->num_rows($res)>0){
        $rowid = (int)$db->fetch_object($res)->rowid;
        $u = new User($db);
        if ($u->fetch($rowid) > 0) return $u;
    }
    return null;
}

// --- 1) Найти/создать админа (очень устойчиво)
$envLogin = getenv("DOLI_ADMIN_LOGIN");
$envPass  = getenv("DOLI_ADMIN_PASSWORD");
$prefLogin = $envLogin ?: "Admin!";
$prefPass  = $envPass  ?: "Admin123!";

$candidates = array("admin", $prefLogin, "Admin!", "AdminNew");
$admin = null;
foreach ($candidates as $lg){
    if (!$lg) continue;
    $admin = fetch_user_by_login($db, $lg);
    if ($admin) break;
}
if (!$admin){
    // пробуем создать
    foreach (array($prefLogin, "AdminNew") as $lgc){
        $admin = create_admin_user($db, $lgc, $prefPass);
        if ($admin) break;
    }
}
if (!$admin){
    // берём первого пользователя в системе и делаем админом
    $admin = fetch_first_user($db);
    if ($admin){
        $admin->admin = 1;
        $admin->update($admin, 1);
    }
}

if (!$admin){
    out("ERROR: cannot create or fetch admin (fallback failed)");
    exit(3);
}
out("Admin login: ".$admin->login);

// гарантируем admin=1
$admin->admin = 1;
$admin->update($admin, 1);
out("Admin flag set to 1");

// --- 2) Включить API и записать ключ
dolibarr_set_const($db, "MAIN_MODULE_API", "1", "chaine", 0, "", 1);
$admin->fetch("", $admin->login);
if (empty($admin->api_key)) {
    $token = bin2hex(random_bytes(32));
    $db->query("UPDATE ".MAIN_DB_PREFIX."user SET api_key='".$db->escape($token)."' WHERE rowid=".(int)$admin->id);
    $admin->fetch("", $admin->login);
}
@file_put_contents($apiKeyFile, $admin->api_key);
out("API key: ".$admin->api_key);

// --- 3) Инициализировать ВСЕ доступные модули (создаст rights_def)
$dir = DOL_DOCUMENT_ROOT."/core/modules";
$inited = 0;
if (is_dir($dir)) {
    foreach (glob($dir."/mod*.class.php") as $file) {
        $base = basename($file);
        $class = basename($file, ".class.php");
        dol_include_once("core/modules/".$base);
        if (class_exists($class)) {
            try {
                $m = new $class($db);
                if (method_exists($m, "init")) {
                    $res = $m->init(1);
                    if ($res >= 0) $inited++;
                }
            } catch (Throwable $e) { /* пропускаем */ }
        }
    }
}
out("Modules initialized: ".$inited);

// --- 4) Выдать ВСЕ права админу из rights_def
$sql = "SELECT rowid FROM ".MAIN_DB_PREFIX."user WHERE login='".$db->escape($admin->login)."'";
$res = $db->query($sql);
$uid = (int)$db->fetch_object($res)->rowid;
$db->query("UPDATE ".MAIN_DB_PREFIX."user SET admin=1 WHERE rowid=".$uid);
$db->query("INSERT INTO ".MAIN_DB_PREFIX."user_rights (fk_user, fk_id)
            SELECT ".$uid.", r.id
            FROM ".MAIN_DB_PREFIX."rights_def r
            LEFT JOIN ".MAIN_DB_PREFIX."user_rights ur ON ur.fk_id = r.id AND ur.fk_user = ".$uid."
            WHERE ur.rowid IS NULL");
$cnt = (int)$db->fetch_object($db->query("SELECT COUNT(*) c FROM ".MAIN_DB_PREFIX."user_rights WHERE fk_user=".$uid))->c;
out("Admin rights count: ".$cnt);

// --- 5) Демо-данные (мягко, не падаем, если уже есть)
dol_include_once("/societe/class/societe.class.php");
dol_include_once("/product/class/product.class.php");
dol_include_once("/compta/facture/class/facture.class.php");

try {
    $soc = new Societe($db); $soc->name="DemoClient LLC"; $soc->client=1; $soc->code_client="DEM001"; $soc->create($admin);
    $prod = new Product($db); $prod->ref="CONSULT001"; $prod->label="Accounting service"; $prod->type=1; $prod->price=1000; $prod->price_ttc=1000; $prod->create($admin);
    $inv = new Facture($db); $inv->socid=1; $inv->date=dol_now(); $inv->cond_reglement_id=1; $inv->mode_reglement_id=1; $idinv=$inv->create($admin);
    if ($idinv>0 && $prod->id>0) $inv->addline($prod->id, $prod->label, 1, $prod->price, 0);
} catch (Throwable $e) { /* no-op */ }

out("done");
