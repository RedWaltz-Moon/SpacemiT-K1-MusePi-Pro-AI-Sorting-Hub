#ifndef CONSULTDIALOG_H
#define CONSULTDIALOG_H

#include <QDialog>
#include <QLineEdit>
#include <QPushButton>
#include <QTableWidget>
#include <QLabel>

class ConsultDialog : public QDialog
{
    Q_OBJECT

public:
    explicit ConsultDialog(QWidget *parent = nullptr);
    ~ConsultDialog();

private slots:
    void onSearch();
    void onKeyPressed();

private:
    void setupUI();
    void performSearch(const QString &keyword);
    QWidget *buildKeyboard();

    QLineEdit    *keywordEdit;
    QTableWidget *table;
    QLabel       *resultCountLabel;
    QPushButton  *m_capsBtn;
    double        m_scale;
    bool          m_capsLock;
};

#endif // CONSULTDIALOG_H
