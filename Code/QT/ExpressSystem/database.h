#ifndef DATABASE_H
#define DATABASE_H

#include <QString>
#include <QList>
#include <QMap>

bool initDatabase(QString *errorMsg = nullptr);
QList<QMap<QString, QString>> fetchAllShipments();
QList<QMap<QString, QString>> fetchUnpickedByPhone(const QString &phoneLast4);
bool markAsPicked(int id);
bool unmarkAsPicked(int id);
QList<QMap<QString, QString>> searchShipments(const QString &keyword);

#endif // DATABASE_H
