/**
 * Author:AbnerMing
 * Time:2022-9-13
 * Desc:git执行commit前判断
 * */
//引入文件操作模块
let fs = require('fs');
//引入child_process模块，用于执行相关命令操作
let exec = require('child_process').exec;

//这个比较重要的，要用这个变量定义最终的执行程序  false符合，通过，不提示，true不符合，不符合就要终止执行，给出提示
var isCheck = false;

/*
*git检测类型，0：全部，1：string文件Name，2：图片命名，3：layout，4：类命名，
*5：类注释，6：方法注释，7：方法命名，8：变量命名，9：try catch
* */
var mCommitType;
//git检测开关，true:开，false:关
var mCommitOpen;
//是否进行增量更新(增量仅命令可用)，true为增量，false为检查整个文件
var mCommitIncrement;
//git提交方式，true为工具，false为命令方式
var mGitCommand;

//规范检查函数，所有的逻辑判断都是通过此函数
let lint = function (cb) {
    //读取文件信息
    let path = require('path');
    let dirname = path.join(__dirname);
    try {
        //读取配置文件，查找对应的配置信息
        let data = fs.readFileSync(dirname + "/gitCommitConfig.android", 'utf-8');
        data.split(/\r?\n/).forEach((line, position) => {
            if (position === 2) {
                let open = line.split("=")[1];
                mCommitOpen = open.toString();//git检测开关
            }
            if (position === 4) {
                let increment = line.split("=")[1];
                mCommitIncrement = increment.toString();//是否进行增量更新
            }
            if (position === 7) {
                let type = line.split("=")[1];
                mCommitType = type.toString();//git检测类型
            }
            if (position === 9) {
                let type = line.split("=")[1];
                mGitCommand = type.toString();//git提交方式
            }
        });
        //根据配置文件进行逻辑判断
        //如果mCommitOpen为true，意味着git开关打开，需要执行检查
        if (mCommitOpen.indexOf("true") !== -1) {
            //mCommitIncrement是否为true，true：增量检查（仅仅适用于命令行操作），false：整个文件的检索
            if (mCommitIncrement.indexOf("true") !== -1) {
                console.log("");
                log('增量检查中，铁子，开始了哦~', 1);
            } else {
                //进行整个文件的检查，全量检查
                console.log("\n");
                log('铁子，我要开始检查你的代码了！', 1);
            }
            // 通过node子进程执行git命令，查看提交的文件列表
            exec('git diff HEAD --name-only --diff-filter=ACMR', function (error, stdout, stderr) {
                if (stdout) {
                    //先检查文件名字是否符合规范
                    log("这次你commit文件列表如下：\n", 1);
                    console.log(stdout + "\n");
                    if (mCommitIncrement.indexOf("true") !== -1) {
                        //执行增量文件检查
                        //获取当前项目根路径
                        let path = require('path');
                        let dirname = path.join(__dirname);
                        checkDiffFile(cb, stdout, dirname);
                    } else {
                        //整个文件开始逐一排查
                        checkFile(stdout, cb);
                    }
                    return;
                }
                //没有文件，直接放行
                log("铁子，你的代码暂时没得问题，放行！\n", 1);
                cb(0);
            });
        } else {
            //如果mCommitOpen为false，意味着不检查，直接绿色通道，通过
            log("检查开关为关，直接通行！\n", 1);
            cb(0);
        }


    } catch (e) {
        if (e.message.indexOf("gitCommitConfig.android") !== -1) {
            //没有文件
            console.log("\n");
            log("\n缺少配置文件[gitCommitConfig.android],请核对后再提交\n", 0);
            log("请执行命令生成文件：node node_modules/android_standard/gitCommitConfig\n", 0);
            log("或手动在项目根目录下创建[gitCommitConfig.android]文件\n", 0);
            log("手动创建内容如下\n", 0);
            log("#git提交配置文件\n" +
                "#git提交前是否进行检测，true:检测，false:不检测\n" +
                "gitCommitSwitch=true\n" +
                "#是否进行增量更新(增量仅命令可用)，true为增量，false为检查整个文件\n" +
                "gitIncrement=false\n" +
                "#git检测类型，0：全部，1：string文件Name，2：图片命名，3：layout，4：类命名，\n" +
                "#5：类注释，6：方法注释，7：方法命名，8：变量命名，9：try catch\n" +
                "gitCheckType=0\n" +
                "#git提交方式，true为工具，false为命令方式\n" +
                "gitCommand=true\n", 3);
        }
        cb(1);
    }
};

/**
 * 增量文件检查
 * */
function checkDiffFile(cb, stdout, dirname) {
    //通过切割换行，拿到文件列表
    let array = stdout.split('\n');
    // 去掉最后一个换行符号
    array.pop();
    log('【针对以上提交文件检查结果如下：】\n', 1);
    //遍历文件，检查相关规范是否符合
    array.forEach(function (value) {
        if (((value.indexOf("png") !== -1
                || value.indexOf("jpg") !== -1
                || value.indexOf("gif") !== -1
                || value.indexOf("webp") !== -1) ||
            (value.indexOf("layout") !== -1 &&
                value.indexOf("xml") !== -1)) && (
            mCommitType.indexOf("0") !== -1 ||
            mCommitType.indexOf("2") !== -1 ||
            mCommitType.indexOf("3") !== -1
        )) {
            //图片或者layout 规范检查
            checkImageOrLayout(value);
        } else if (value.indexOf("kt") !== -1 || value.indexOf("java") !== -1) {
            //Kotlin或者Java，规范检查
            let lastPosition = value.lastIndexOf("/");
            let className = value.substring(lastPosition + 1, value.length);
            //检查类的名字是否规范
            checkClassName(className, value);
        }
    });
    //生成增量文件，并使用命令，写入增量代码
    fs.writeFile(dirname + "/androidCommit.diff", "", function (err) {
        if (err) {
            log('增量检查中断', 0);
            return;
        }
        exec('git diff >> androidCommit.diff', function (error, stdout, stderr) {
            //增量代码写入后，进行读取diff文件
            checkDiff(cb, dirname);
        });
    });

    setTimeout(function () {
        console.log("\n");
        if (isCheck) {
            cb(1);
        } else {
            log("增量检查完毕，暂未发现问题，真棒！！！\n", 2);
            cb(0);
        }
    }, 1500);
}

/**
 * 整个文件进行检查,也就是全量文件检查
 * files：当前commit的文件列表
 * cb:进程，1，终止，0，执行
 * */
function checkFile(files, cb) {
    let path = require('path');
    let dirname = path.join(__dirname);
    let array = files.split('\n');//通过切割换行，拿到文件列表
    array.pop();// 去掉最后一个换行符号
    log('【针对以上提交文件检查结果如下：】\n', 1);
    array.forEach(function (value) {
        //判断文件是什么类型
        if (value.indexOf("kt") !== -1 || value.indexOf("java") !== -1) {
            //kotlin文件或者java文件
            checkClassOrString(dirname + "/" + value, value, 0);
        } else if (value.indexOf("string") !== -1 && (
            mCommitType.indexOf("0") !== -1 ||
            mCommitType.indexOf("1") !== -1
        )) {
            //string文件name命名规范检查
            checkClassOrString(dirname + "/" + value, value, 1);
        } else if ((value.indexOf("png") !== -1
                || value.indexOf("jpg") !== -1
                || value.indexOf("gif") !== -1
                || value.indexOf("webp") !== -1) &&
            (mCommitType.indexOf("0") !== -1 ||
                mCommitType.indexOf("2") !== -1)) {
            //图片文件命名规范检查
            checkImageOrLayout(value);
        } else if ((value.indexOf("layout") !== -1 &&
            value.indexOf("xml") !== -1) && (
            mCommitType.indexOf("0") !== -1 ||
            mCommitType.indexOf("3") !== -1
        )
        ) {
            //layout 检查资源命名规范检查
            checkImageOrLayout(value);
        }

    });

    setTimeout(function () {
        console.log("\n");
        if (isCheck) {
            cb(1);
        } else {
            log("所有文件均检查完毕，暂未发现问题，真棒！！！\n", 2);
            cb(0);
        }
    }, 1500);
}

/**
 * 检查类的名字是否规范
 * */
function checkClassName(className, value) {
    if (mCommitType.indexOf("0") !== -1
        || mCommitType.indexOf("4") !== -1) {
        if (!checkCase(className.substring(0, 1)) ||
            className.indexOf("_") !== -1) {
            //不符合
            isCheck = true;
            log("【" + value + "】,类命名不规范", 0);
        }
    }
}

/**
 * 检查类文件或者String文件
 * type:0,kotlin文件或者java文件,1,string文件name命名规范检查
 * */
function checkClassOrString(path, value, type) {
    let moduleName = getModuleName(value);//模块名字
    let data = fs.readFileSync(path, 'utf-8');// 拿到文件内容
    if (type === 0) {
        //java和kotlin文件
        //首先检查命名，然后在类注释，方法，变量等
        let lastPosition = value.lastIndexOf("/");
        let className = value.substring(lastPosition + 1, value.length);
        //首先检查类命名是否规范
        checkClassName(className, value);
        setTimeout(function () {
            //检查类注释是否规范
            if (mCommitType.indexOf("0") !== -1 || mCommitType.indexOf("5") !== -1) {
                checkClassNotes(className, data);
            }
        }, 200);
        setTimeout(function () {
            //检查方法注释是否规范
            if (mCommitType.indexOf("0") !== -1 || mCommitType.indexOf("6") !== -1) {
                checkMethodNotes(className, data);
            }
        }, 400);
        setTimeout(function () {
            //检查方法命名是否规范
            if (mCommitType.indexOf("0") !== -1 || mCommitType.indexOf("7") !== -1) {
                checkMethodName(className, data);
            }
        }, 600);
        setTimeout(function () {
            //检查变量命名是否规范
            if (mCommitType.indexOf("0") !== -1 || mCommitType.indexOf("8") !== -1) {
                checkVariableName(className, data);
            }

        }, 800);
        setTimeout(function () {
            //检查try catch 是否添加
            if (mCommitType.indexOf("0") !== -1 || mCommitType.indexOf("9") !== -1) {
                checkTry(className, data);
            }

        }, 1000);
    } else if (type === 1) {
        // string
        if (moduleName.indexOf("app") === -1 && moduleName.indexOf("libBase") === -1) {
            let stringArr = data.split("name=\"");
            stringArr.forEach(function (item, position) {
                if (item.indexOf("encoding") === -1) {
                    let i = item.indexOf("\"");
                    let endString = item.substring(0, i);
                    if (endString !== "" && !endString.startsWith(moduleName)) {
                        //开头不是
                        isCheck = true;
                        log("【" + value + "中，name为" + endString + "】,命名不规范", 0);
                    }
                }

            });
        }
    }
}

/**
 * 获取模块的名字
 * */
function getModuleName(value) {
    let imagePosition = value.indexOf("/");
    var moduleName = value.substring(0, imagePosition);//模块名字
    //去除module
    if (moduleName.indexOf("module_") !== -1) {
        //包含
        moduleName = moduleName.replace("module_", "");
    }
    return moduleName;
}

function checkCase(ch) {
    if (ch === ch.toUpperCase()) {
        return true;
    } else {
        return false;
    }
}

/**
 * 类注释检查是否规范
 * */
function checkClassNotes(className, data) {
    if (data.indexOf("{") !== -1) {
        let dd = data.split("{")[0];
        if (dd.indexOf("author") === -1
            || dd.indexOf("date") === -1
            || dd.indexOf("desc") === -1) {
            //不符合
            isCheck = true;
            log("【" + className + "】,类注释不规范", 0);
        }
    }
}

/**
 * 检查方法注释是否规范
 * */
function checkMethodNotes(className, data) {
    var eachOk = 0;
    var eachNo = 0;
    var caseNode = [];//不符合的方法
    if (className.indexOf("kt")) {
        //kotlin
        let kotlin = data.split("fun");
        kotlin.forEach(function (item, position) {
            let endItem = item.trim();
            let override = endItem.substring(endItem.length - 20, endItem.length);
            //判断是否包含
            if (position !== kotlin.length - 1) {
                if (override.indexOf("override") === -1) {
                    let endM = kotlin[position + 1];
                    //有注释的也要另行添加
                    let kE = endItem.lastIndexOf("}");
                    let endK = endItem.substring(kE, endItem.length);
                    if (endK.indexOf("//") !== -1 || endK.indexOf("*/") !== -1) {
                        //带有注释
                        eachOk++;
                    } else {
                        //没有注释
                        //不符合的方法
                        let tr = endM;
                        if (tr != null) {
                            let positionCase = tr.indexOf("(");
                            let endCase = tr.substring(0, positionCase);
                            //去掉构造函数
                            if (endCase.length < 30 && className.indexOf(endCase) === -1) {
                                eachNo++;
                                caseNode.push(endCase);
                            }
                        }
                    }
                }

            }
        });

    } else {
        //java
        //遍历方法
        let java = data.split(") {");
        java.forEach(function (item, position) {
            if (item.indexOf("public") !== -1
                || item.indexOf("protected") !== -1
                || item.indexOf("private") !== -1) {

                //判断是否包含}
                if (item.indexOf("}") !== -1) {
                    let lastDesc = item.lastIndexOf("}");
                    let endDesc = item.substring(lastDesc, item.length);
                    if (endDesc.indexOf("Override") === -1) {
                        if (endDesc.indexOf("//") !== -1 || endDesc.indexOf("/*") !== -1) {
                            //包含
                            eachOk++;
                        } else {
                            if (item.indexOf("while") === -1
                                && item.indexOf("if") === -1
                                && item.indexOf("for") === -1) {

                                //添加方法
                                let lastK = item.lastIndexOf("(");
                                let lasetContent = item.substring(0, lastK);
                                let endContent = lasetContent.split(" ");//取最后一个

                                let javaMethod = endContent[endContent.length - 1];
                                if (className.indexOf(javaMethod) === -1) {
                                    //不符合的方法
                                    eachNo++;
                                    caseNode.push(javaMethod);
                                }

                            }

                        }


                    }
                } else {

                    let lastPrivate = item.lastIndexOf("private");
                    let lastPublic = item.lastIndexOf("public");
                    let lastProtected = item.lastIndexOf("protected");
                    var endLast = lastPrivate;
                    if (lastPublic > endLast) {
                        endLast = lastPublic;
                    }
                    if (lastProtected > endLast) {
                        endLast = lastPublic;//获取最后一个
                    }

                    let endString = item.substring(endLast - 50, endLast);
                    if (endString.indexOf("Override") === -1) {
                        if (endString.indexOf("//") !== -1 || endString.indexOf("*/") !== -1) {
                            //包含
                            eachOk++;
                        } else {
                            //添加方法
                            let lastK = item.lastIndexOf("(");
                            let lasetContent = item.substring(0, lastK);
                            let endContent = lasetContent.split(" ");//取最后一个
                            let javaMethod = endContent[endContent.length - 1];
                            if (className.indexOf(javaMethod) === -1) {
                                //不符合的方法
                                eachNo++;
                                caseNode.push(javaMethod);
                            }
                        }

                    }

                }

            }
        });

    }

    if (eachNo !== 0) {
        isCheck = true;
        log("\n【" + className + "】,未添加注释的方法如下：\n", 1);
        log(caseNode, 0);
    }
}

/**
 * 检查方法命名是否规范
 * */
function checkMethodName(className, data) {
//遍历方法
    var eachOk = 0;
    var eachNo = 0;
    var caseNode = [];//不符合的方法

    //遍历所有的方法，判断是kt还是java
    if (className.indexOf("kt") !== 0) {
        //kotlin
        let kotlin = data.split("fun");
        kotlin.forEach(function (item, position) {
            if (position !== 0) {
                //判断开头是大写还是小写
                let tr = item.trim();
                let indexCase = tr.substring(0, 1);
                let positionCase = tr.indexOf("(");
                let endCase = tr.substring(0, positionCase);
                if (endCase.indexOf("<") === -1
                    && endCase !== "" && className.indexOf(endCase) === -1) {
                    if ((checkCase(indexCase)
                        || endCase.indexOf("_") !== -1)) {
                        //不符合
                        eachNo++;
                        //添加方法
                        caseNode.push(endCase);
                    } else {
                        //符合
                        eachOk++;
                    }
                }
            }

        });

    } else {
        //java
        //遍历方法
        let java = data.split(") {");
        java.forEach(function (item, position) {
            if (item.indexOf("public") !== -1
                || item.indexOf("protected") !== -1
                || item.indexOf("private") !== -1) {

                //获取最后一个括号
                let lastK = item.lastIndexOf("(");
                let lasetContent = item.substring(0, lastK);
                let endContent = lasetContent.split(" ");//取最后一个
                let endMethod = endContent[endContent.length - 1];

                if (endMethod.indexOf("<") === -1
                    && endMethod !== "" &&
                    className.indexOf(endMethod) === -1
                    && endMethod.indexOf("(") === -1) {
                    if (checkCase(endMethod.substring(0, 1)) || endMethod.indexOf("_") !== -1) {
                        //不符合
                        eachNo++;
                        //添加方法
                        caseNode.push(endMethod);
                    } else {
                        //符合
                        eachOk++;
                    }
                }

            }

        });
    }

    if (eachNo !== 0) {
        //不符合
        isCheck = true;
        log("\n【" + className + "】,方法命名不规范的如下：\n", 1);
        log(caseNode, 0);
    }
}

/**
 * 检查变量命名是否规范
 * */
function checkVariableName(className, data) {
    var eachOk = 0;
    var eachNo = 0;
    var caseNode = [];//不符合的方法

    //遍历所有的方法，判断是kt还是java
    if (className.indexOf("kt") !== -1) {
        //以等号分割
        let spD = data.split("=");
        spD.forEach(function (item, position) {
            //然后判断val 和 var
            let lastVal = item.lastIndexOf("val");
            let lastVar = item.lastIndexOf("var");
            var endLast = lastVal;
            if (lastVar > lastVal) {
                endLast = lastVar;
            }
            let lastContent = item.substring(endLast, item.length);

            if (lastContent.indexOf("val") !== -1
                || lastContent.indexOf("var") !== -1) {
                if (lastContent.indexOf("fun") === -1) {
                    let endK = lastContent.split(" ")[1];
                    //判断变量是否符合要求
                    if (endK.indexOf("R") === -1
                        && endK.indexOf("!") === -1
                        && endK.indexOf(")") === -1
                        && endK.indexOf("{") === -1
                        && endK.indexOf("}") === -1) {
                        if (endK.indexOf("<") === -1 && endK !== "") {
                            //这里进行判断大小写
                            const p = /^[A-Z_]*$/g;
                            if (p.test(endK)) {
                                //符合
                                eachOk++;
                            } else {
                                if ((checkCase(endK.substring(0, 1))
                                    || endK.indexOf("_") !== -1)) {
                                    //不符合
                                    eachNo++;
                                    //添加方法
                                    caseNode.push(endK);
                                } else {
                                    //符合
                                    eachOk++;
                                }
                            }


                        }

                    }

                }
            }

        });

    } else {
        //java
        //判断

        let spF = data.split(";");
        spF.forEach(function (item, position) {
            let lastPrivate = item.lastIndexOf("private");
            let lastPublic = item.lastIndexOf("public");
            let lastProtected = item.lastIndexOf("protected");
            var endLast = lastPrivate;
            if (lastPublic > endLast) {
                endLast = lastPublic;
            }
            if (lastProtected > endLast) {
                endLast = lastPublic;//获取最后一个
            }

            let lastContent = item.substring(endLast, item.length);

            if (lastContent.indexOf("public") !== -1
                || lastContent.indexOf("protected") !== -1
                || lastContent.indexOf("private") !== -1) {

                //是否包含等号
                if (lastContent.indexOf("=") !== -1) {
                    let a = lastContent.trim().split("=");
                    let b = a[0].trim().split(" ");
                    let endC = b[b.length - 1];

                    if (endC.indexOf("R") === -1
                        && endC.indexOf("!") === -1
                        && endC.indexOf(")") === -1
                        && endC.indexOf("(") === -1
                        && endC.indexOf("{") === -1
                        && endC.indexOf("}") === -1) {
                        //判断变量是否符合要求
                        const p = /^[A-Z_]*$/g;
                        if (p.test(endC)) {
                            eachOk++;
                        } else {
                            if (endC.indexOf("<") === -1 && endC !== "") {
                                if ((checkCase(endC.substring(0, 1))
                                    || endC.indexOf("_") !== -1)) {
                                    //不符合
                                    eachNo++;
                                    //添加方法
                                    caseNode.push(endC);
                                } else {
                                    //符合
                                    eachOk++;
                                }
                            }
                        }

                    }


                } else {
                    //普通的成员变量
                    let endItem = lastContent.trim().split(" ");
                    let endContent = endItem[endItem.length - 1];//最后的内容

                    if (endContent.indexOf("R") === -1
                        && endContent.indexOf("!") === -1
                        && endContent.indexOf(")") === -1
                        && endContent.indexOf("(") === -1
                        && endContent.indexOf("{") === -1
                        && endContent.indexOf("}") === -1) {
                        //判断变量是否符合要求
                        if (endContent.indexOf("<") === -1 && endContent !== "") {
                            const p = /^[A-Z_]*$/g;
                            if (p.test(endContent)) {
                                eachOk++;
                            } else {
                                if ((checkCase(endContent.substring(0, 1))
                                    || endContent.indexOf("_") !== -1)) {
                                    //不符合
                                    eachNo++;
                                    //添加方法
                                    caseNode.push(endContent);
                                } else {
                                    //符合
                                    eachOk++;

                                }
                            }

                        }
                    }


                }
            }


        });

    }

    if (eachNo !== 0) {
        //不符合
        isCheck = true;
        log("\n【" + className + "】,变量命名不规范的如下：\n", 1);
        log(caseNode, 0);
    }
}

/**
 * try  catch 是否添加
 * */
function checkTry(className, data) {
    //遍历所有的方法，判断是kt还是java
    var kj;
    if (className.indexOf("kt") !== -1) {
        //kotlin
        kj = data.split("fun");
    } else if (className.indexOf("java") !== -1) {
        //java
        kj = data.split("void");
    } else {
        kj = [];
    }
    //遍历方法
    var eachOk = 0;
    var eachNo = 0;
    kj.forEach(function (item, position) {
        if (position !== 0) {
            if (item.indexOf("try") !== -1 && item.indexOf("catch") !== -1) {
                //符合的方法
                eachOk++;
            } else {
                //不符合的方法
                eachNo++;
            }
        }
    });

    if (eachNo !== 0) {
        //不符合
        isCheck = true;
        log("【" + className + "】,检测到有未添加try catch的方法", 0);
    }
}

/**
 * 增量代码进行检查是否规范
 * */
function checkDiff(cb, dirname) {
    //读取增量文件代码
    let data = fs.readFileSync(dirname + "/androidCommit.diff", 'utf-8');
    if (data === "" || data == null) {
        log("\n【增量代码无法检查】，这种情况下请您Github上Issues反馈\n", 0);
        return;
    }
    log('\n增量代码文件生成中\n', 1);
    //获取到所有的问题内容后
    let diffArray = data.split("+++ b");
    if (mCommitType.indexOf("0") !== 0 ||
        mCommitType.indexOf("1") !== 0) {
        diffArray.forEach(function (value) {
            //判断string
            if (value.indexOf("function") === -1 &&
                value.indexOf("string.xml") !== -1
                && value.indexOf("</string>") !== -1) {
                //string文件
                var mName;
                value.split(/\r?\n/).forEach((line, position) => {
                    if (position === 0) {
                        let moduleName = line.trim().substring(1, line.length);
                        let moduleIndex = moduleName.indexOf("/");
                        mName = moduleName.substring(0, moduleIndex);
                    }

                    if (line.indexOf("</string>") !== -1) {
                        //判断string name
                        if (mName.indexOf("app") === -1 && mName.indexOf("libBase") === -1) {
                            let stringArr = line.split("name=\"");
                            stringArr.forEach(function (item, position) {
                                let i = item.indexOf("\"");
                                let endString = item.substring(0, i);
                                if (endString !== "" && !endString.startsWith(mName)) {
                                    //开头不是
                                    isCheck = true;
                                    log("【" + mName + "模块中string文件，name为" + endString + "】,命名不规范", 0);
                                }
                            });
                        }
                    }

                });
            }
        });
    }

    //判断类
    setTimeout(function () {
        diffArray.forEach(function (value) {
            if (value.indexOf("@@") !== -1 && value.indexOf("+  ") !== -1) {
                var mFileName = "";
                value.split(/\r?\n/).forEach((line, position) => {
                    if (position === 0 && line.startsWith("/")) {
                        //文件名
                        mFileName = line.trim();
                    }
                    //java和kt
                    if (mFileName.indexOf("kt") !== -1 || mFileName.indexOf("java") !== -1) {

                        //增量代码就得另类考虑和判断了
                        //1 先判断方法名字
                        if (line.indexOf("fun") !== -1 && (
                            mCommitType.indexOf("0") !== -1 ||
                            mCommitType.indexOf("7") !== -1
                        )) {
                            //kotlin方法
                            let funIndex = line.indexOf("fun");
                            let funString = line.substring(funIndex + 3, line.length).trim();
                            let funEnd = funString.split("(")[0];
                            //判断方法名字
                            if (checkCase(funEnd.substring(0, 1)) || funEnd.indexOf("_") !== -1) {
                                isCheck = true;
                                log("【" + mFileName + "】中的方法" + funEnd + ",不符合规范，请您整改", 0);
                            }
                        }
                        if ((line.indexOf(") {") !== -1 || line.indexOf("Exception {") !== -1) && (
                            mCommitType.indexOf("0") !== -1 ||
                            mCommitType.indexOf("7") !== -1
                        )) {
                            //java方法
                            let javaIndex = line.indexOf("(");
                            let javaMethods = line.substring(0, javaIndex);
                            let javaMArray = javaMethods.split(" ");
                            let methodName = javaMArray[javaMArray.length - 1];
                            if ((checkCase(methodName.substring(0, 1)) || methodName.indexOf("_") !== -1)
                                && methodName !== "") {
                                isCheck = true;
                                log("【" + mFileName + "】中的方法" + methodName + ",不符合规范，请您整改", 0);
                            }
                        }
                        //2判断变量
                        if ((line.indexOf("var") !== -1 || line.indexOf("val") !== -1) &&
                            line.indexOf("+") !== -1
                        ) {
                            // kotlin变量
                            //1、包含=  2包含 :
                            var kotlinArr = [];
                            if (line.indexOf(":") !== -1) {
                                kotlinArr = line.split(":");
                            } else {
                                kotlinArr = line.split("=");
                            }

                            let varA = kotlinArr[0].trim();
                            let varEndArr = varA.split(" ");
                            let varEnd = varEndArr[varEndArr.length - 1];
                            //判断变量的名字
                            if ((checkCase(varEnd.substring(0, 1))
                                || varEnd.indexOf("_") !== -1)) {
                                const p = /^[A-Z_]*$/g;
                                if (!p.test(varEnd)) {
                                    isCheck = true;
                                    log("【" + mFileName + "】中的变量" + varEnd + ",不符合规范，请您整改", 0)
                                }
                            }

                        }

                    }

                });
            }
        });
    }, 300);
}

/**
 * 检查图片或者layout资源命名是否规范
 * */
function checkImageOrLayout(value) {
    //图片和layout  直接判断命名
    let moduleName = getModuleName(value);
    //过滤app和libBase
    if (moduleName.indexOf("app") === -1 && moduleName.indexOf("libBase") === -1) {
        let lastPosition = value.lastIndexOf("/");
        let xmlName = value.substring(lastPosition, value.length);
        if (!xmlName.startsWith(moduleName)) {
            isCheck = true;
            log("【" + xmlName + "】,命名不规范", 0);
        }
    }
}

// //调用 lint 函数
// let startTask = function () {
//     lint(function () {
//         //它可以是0或1,0表示没有任何类型的故障结束进程，而1表示由于某种故障而结束进程
//         process.exit(1);
//     })
// }
// // 调用startTask方法，进行执行检查
// startTask();

let taskList = [lint];
// 执行检查
let startTask = function () {
    if (!taskList.length) {
        process.exit(0);
        return;
    }
    let func = taskList.shift();
    func(function (pass) {
        if (pass === 1) {
            process.exit(1);
            return;
        }
        startTask();
    });
}
//调用startTask方法，进行执行检查
startTask();


//log日志展示，其实就是提交信息展示，命令提交进行特殊符合处理
function log(message, type) {
    //工具提交
    if (mGitCommand === "true") {
        console.log(message);
    } else {
        //命令行方式
        if (type === 2) {
            console.log("\x1B[32m%s\x1B[39m", message);//颜色：green
        } else if (type === 1) {
            console.log('\x1B[36m%s\x1B[39m', message);//颜色：cyan
        } else if (type === 0) {
            console.log('\x1B[31m%s\x1B[39m', message);//颜色：red
        } else if (type === 3) {
            console.log('\x1B[33m%s\x1B[39m', message);//颜色：yellow
        }
    }

}