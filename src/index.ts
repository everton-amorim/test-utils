type Input = {
    errorFilter? : string
    just? : string
    skip?: string[]
    doNotBreak?: boolean
    verbose?: boolean
}
function Tester(params: Input) {

    
    var __failed = []


    function handleError(err) {
        var { errorFilter, verbose } = params

        if (err.changes) {
            if (err.changes.length && errorFilter) {
                err.changes = err.changes.filter( item => {
                    if (!item.path) return;
                    let pathStr = item.path.join('.');
                    return pathStr.endsWith(errorFilter)
                });
            }
            if (err.changes.length > 3 && !verbose) {
                err.changes = err.changes.slice(0,3);
                console.log(' -- More than 3 differences. Omitting some results... -- '.red);            
            }
            err.changes.forEach( e => printDiff(e) );
        }
        else console.error(err);
        //console.error('response>>', err.response);
        //console.error('expected>>', err.expected);
        if (!params.doNotBreak) process.exit(0);
        else {
            __failed.push(err.casename||'');
        }
    }


    function printDiff(diffObj) {
        var kindmap = {
            N : 'aditional element' ,
            D : 'extra element' ,
            E : 'different value' ,
            A : 'difference in array'
        };
        
        var {kind,path,lhs,rhs,index,item} = diffObj;

        console.error( kindmap[kind] );
        if (path) console.error('at:', path.join(' > '));
        if (index) console.error('index:', index);
        if (rhs !== undefined) console.error('expected:' , rhs, typeof rhs);
        if (lhs !== undefined) console.error('got:' , lhs, typeof lhs);
        if (item) console.error('item:',item);
        console.error('-----');
    }
    

    function verifyDiff(diffobj, ignoreFields) {
        ignoreFields = ignoreFields || [];
        diffobj = diffobj || [];
        ignoreFields = ignoreFields.map( fs => {
            return fs.split('.').filter( f => f );
        });
        var changesFiltered = diffobj.filter( c => {
            if (c.path) {
                let anyEqual = ignoreFields.some( fieldref => {
                    return !fieldref.some( (f,idx) => {
                        let thisField = c.path[idx];
                        if (f == '[]' /*&& !isNaN(parseInt(thisField))*/) return;
                        if (f != thisField) return true;
                    });
                });
                //if (anyEqual) console.log('filtering diff', c.path);
                return !anyEqual;
            }
            return true;
        });
        var isOk = changesFiltered.length === 0;
        return { changesFiltered , isOk };
    }

    var _queue: { description: string, fn: Function }[] = []

    return class {
        static add(description: string, fn: () => void)    
        static add(description: string, fn: () => Promise<any>)    
        static add(description, fn) {
            _queue.push({description, fn})
        }

        static run() {
            return _queue.reduce(
                (chain, current, idx) => {
                    return chain.then(() => {
                        console.log(`${idx}. ${current.description}`)
                        return current.fn()
                            .then(() => console.log('OK'))
                            .catch(err => {
                                console.error('Fail on ${current.description}')
                                console.error(err)
                                throw 'BAIL'
                            })
                    })
                } ,
                Promise.resolve()
            ).catch( err => {
                if (err === 'BAIL') process.exit(0)
                handleError(err)
            })
        }        
    }
}