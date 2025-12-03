<?php
error_reporting(E_ALL & ~E_NOTICE);
ini_set("display_errors", 1);

require_once "/var/www/html/master.inc.php";

// 1) Инициализируем все модули, у которых есть класс mod*.class.php и метод init()
$root = DOL_DOCUMENT_ROOT;
$dir  = $root."/core/modules";

// Безопасно перебираем модульные классы
$initialized = 0;
if (is_dir($dir)) {
    foreach (glob($dir."/mod*.class.php") as $file) {
        $base = basename($file);                                 // напр., modSociete.class.php
        $class = basename($file, ".class.php");                  // напр., modSociete
        // подключаем через dol_include_once, чтобы пути были корректны
        dol_include_once("core/modules/".$base);
        if (class_exists($class)) {
            try {
                $m = new $class($db);
                if (method_exists($m, "init")) {
                    // init(1) — стандартная активация (создаёт константы, права, меню и др.)
                    $res = $m->init(1);
                    if ($res >= 0) $initialized++;
                }
            } catch (Throwable $e) {
                // игнорируем модули, которые не подходят для данной сборки
            }
        }
    }
}

// 2) Выдаём все права админу из актуального llx_rights_def
require_once DOL_DOCUMENT_ROOT."/core/lib/admin.lib.php";

$login = getenv("DOLI_ADMIN_LOGIN"); if (!$login) $login = "admin";

// найдём rowid админа
$sql = "SELECT rowid FROM ".MAIN_DB_PREFIX."user WHERE login='".$db->escape($login)."'";
$res = $db->query($sql);
if ($res && $db->num_rows($res)>0) {
    $uid = (int) $db->fetch_object($res)->rowid;

    // на всякий случай admin=1
    $db->query("UPDATE ".MAIN_DB_PREFIX."user SET admin=1 WHERE rowid=".$uid);

    // массовая раздача всех прав
    $sql = "INSERT INTO ".MAIN_DB_PREFIX."user_rights (fk_user, fk_id)
            SELECT ".$uid.", r.id
            FROM ".MAIN_DB_PREFIX."rights_def r
            LEFT JOIN ".MAIN_DB_PREFIX."user_rights ur
              ON ur.fk_id = r.id AND ur.fk_user = ".$uid."
            WHERE ur.rowid IS NULL";
    $db->query($sql);

    // итог
    $res2 = $db->query("SELECT COUNT(*) AS c FROM ".MAIN_DB_PREFIX."user_rights WHERE fk_user=".$uid);
    $cnt = ($res2 ? (int)$db->fetch_object($res2)->c : -1);
    echo "OK: modules_initialized=".$initialized."; rights_count=".$cnt."\\n";
} else {
    echo "ERROR: admin user not found\\n";
}
