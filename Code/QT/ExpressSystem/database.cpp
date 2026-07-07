#include "database.h"
#include <QSqlDatabase>
#include <QSqlQuery>
#include <QSqlError>
#include <QDebug>

static const QString DB_HOST = "121.40.169.218";
static const int     DB_PORT = 3306;
static const QString DB_NAME = "qiansai";
static const QString DB_USER = "redwaltz";
static const QString DB_PWD  = "123456";

bool initDatabase(QString *errorMsg)
{
    QSqlDatabase db = QSqlDatabase::addDatabase("QMYSQL");
    db.setHostName(DB_HOST);
    db.setPort(DB_PORT);
    db.setDatabaseName(DB_NAME);
    db.setUserName(DB_USER);
    db.setPassword(DB_PWD);

    if (!db.open()) {
        if (errorMsg) *errorMsg = db.lastError().text();
        return false;
    }

    QSqlQuery query;
    query.exec("SET NAMES 'utf8mb4'");

    // 为 shipments 补齐取件系统需要的列
    QMap<QString, QString> requiredFields;
    requiredFields["phone_last4"] = "VARCHAR(4) NOT NULL DEFAULT ''";
    requiredFields["location"]    = "VARCHAR(100) NOT NULL DEFAULT ''";
    requiredFields["status"]      = "TINYINT NOT NULL DEFAULT 0";

    for (auto it = requiredFields.begin(); it != requiredFields.end(); ++it) {
        QString check = QString("SHOW COLUMNS FROM shipments LIKE '%1'").arg(it.key());
        if (!query.exec(check) || !query.next()) {
            QString alter = QString("ALTER TABLE shipments ADD COLUMN %1 %2").arg(it.key(), it.value());
            if (!query.exec(alter)) {
                qDebug() << "添加字段失败:" << it.key() << query.lastError().text();
            }
        }
    }

    return true;
}

QList<QMap<QString, QString>> fetchAllShipments()
{
    QList<QMap<QString, QString>> result;
    QSqlQuery query("SELECT id, tracking_number, raw_text, category, "
                    "DATE_FORMAT(created_at, '%Y/%m/%d %H:%i:%s'), "
                    "RIGHT(phone_suffix, 4), location, status, "
                    "DATE_FORMAT(created_at, '%Y/%m/%d %H:%i:%s') "
                    "FROM shipments ORDER BY id DESC");
    while (query.next()) {
        QMap<QString, QString> row;
        row["id"]              = query.value(0).toString();
        row["tracking_number"] = query.value(1).toString();
        row["raw_text"]        = query.value(2).toString();
        row["category_name"]   = query.value(3).toString();
        row["created_at"]      = query.value(4).toString();
        row["phone_last4"]     = query.value(5).toString();
        row["location"]        = query.value(6).toString();
        row["status"]          = query.value(7).toString();
        row["storage_time"]    = query.value(8).toString();
        result.append(row);
    }
    return result;
}

QList<QMap<QString, QString>> fetchUnpickedByPhone(const QString &phoneLast4)
{
    QList<QMap<QString, QString>> result;
    QSqlQuery query;
    query.prepare("SELECT id, tracking_number, location, category "
                  "FROM shipments WHERE RIGHT(phone_suffix, 4) = :phone AND status = 0");
    query.bindValue(":phone", phoneLast4);
    if (!query.exec()) return result;
    while (query.next()) {
        QMap<QString, QString> row;
        row["id"]              = query.value(0).toString();
        row["tracking_number"] = query.value(1).toString();
        row["location"]        = query.value(2).toString();
        row["category_name"]   = query.value(3).toString();
        result.append(row);
    }
    return result;
}

bool markAsPicked(int id)
{
    QSqlQuery query;
    query.prepare("UPDATE shipments SET status = 1 WHERE id = :id");
    query.bindValue(":id", id);
    return query.exec();
}

bool unmarkAsPicked(int id)
{
    QSqlQuery query;
    query.prepare("UPDATE shipments SET status = 0 WHERE id = :id");
    query.bindValue(":id", id);
    return query.exec();
}

QList<QMap<QString, QString>> searchShipments(const QString &keyword)
{
    QList<QMap<QString, QString>> result;
    QSqlQuery query;
    query.prepare("SELECT id, tracking_number, raw_text, category, location, "
                  "status, RIGHT(phone_suffix, 4), "
                  "DATE_FORMAT(created_at, '%Y/%m/%d %H:%i:%s'), "
                  "DATE_FORMAT(created_at, '%Y/%m/%d %H:%i:%s') "
                  "FROM shipments WHERE phone_suffix LIKE :kw OR tracking_number LIKE :kw");
    QString likeKw = "%" + keyword + "%";
    query.bindValue(":kw", likeKw);
    if (!query.exec()) return result;
    while (query.next()) {
        QMap<QString, QString> row;
        row["id"]              = query.value(0).toString();
        row["tracking_number"] = query.value(1).toString();
        row["raw_text"]        = query.value(2).toString();
        row["category_name"]   = query.value(3).toString();
        row["location"]        = query.value(4).toString();
        row["status"]          = query.value(5).toString();
        row["phone_last4"]     = query.value(6).toString();
        row["created_at"]      = query.value(7).toString();
        row["storage_time"]    = query.value(8).toString();
        result.append(row);
    }
    return result;
}
