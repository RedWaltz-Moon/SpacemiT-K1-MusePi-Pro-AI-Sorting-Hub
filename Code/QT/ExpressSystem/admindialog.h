#ifndef ADMINTDIALOG_H
#define ADMINTDIALOG_H

#include <QDialog>
#include <QTableWidget>
#include <QTimer>
#include <QLabel>

class AdminDialog : public QDialog
{
    Q_OBJECT

public:
    explicit AdminDialog(QWidget *parent = nullptr);
    ~AdminDialog();

private slots:
    void refreshTable();
    void onPickForRow(int row);
    void onUnpickForRow(int row);

private:
    void setupUI();
    void controlMotor(const QString &location);
    void populateRow(int i, const QMap<QString, QString> &row);

    QTableWidget *table;
    QLabel       *statsLabel;
    QTimer       *refreshTimer;
    double        m_scale;
};

#endif // ADMINTDIALOG_H
