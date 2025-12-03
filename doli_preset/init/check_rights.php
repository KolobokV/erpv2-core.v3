<?php
require "/var/www/html/master.inc.php";

global $db;
$login = "admin";
$sql = "SELECT COUNT(*) as c
        FROM ".MAIN_DB_PREFIX."user_rights ur
        JOIN ".MAIN_DB_PREFIX."user u ON u.rowid = ur.fk_user
        WHERE u.login = '".$db->escape($login)."'";

$res = $db->query($sql);
if (!$res) {
    echo "ERROR: ".$db->lasterror()."\n";
    exit(1);
}
$o = $db->fetch_object($res);
echo "rights=".($o ? $o->c : 0)."\n";
