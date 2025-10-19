/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/voting.json`.
 */
export type Voting = {
  "address": "25aB1D3Q1rtrJDuhME83HpfLoWLvZMuFmtYnH7UvMDLb",
  "metadata": {
    "name": "voting",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Arcium & Anchor"
  },
  "instructions": [
    {
      "name": "createMultiOptionPoll",
      "docs": [
        "Creates a new multi-option poll (2-4 options) for DAO voting.",
        "",
        "This initializes a multi-option poll account and sets up the encrypted vote counters.",
        "Each option gets its own encrypted counter, and all votes remain confidential until reveal.",
        "",
        "# Arguments",
        "* `id` - Unique identifier for this poll",
        "* `question` - The poll question",
        "* `options` - Array of 2-4 option strings",
        "* `nonce` - Cryptographic nonce for initializing encrypted vote counters"
      ],
      "discriminator": [
        145,
        208,
        171,
        221,
        68,
        200,
        248,
        208
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "signPdaAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  83,
                  105,
                  103,
                  110,
                  101,
                  114,
                  65,
                  99,
                  99,
                  111,
                  117,
                  110,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "mxeAccount"
        },
        {
          "name": "mempoolAccount",
          "writable": true
        },
        {
          "name": "executingPool",
          "writable": true
        },
        {
          "name": "computationAccount",
          "writable": true
        },
        {
          "name": "compDefAccount"
        },
        {
          "name": "clusterAccount",
          "writable": true
        },
        {
          "name": "poolAccount",
          "writable": true,
          "address": "7MGSS4iKNM4sVib7bDZDJhVqB6EcchPwVnTKenCY1jt3"
        },
        {
          "name": "clockAccount",
          "address": "FHriyvoZotYiFnbUzKFjzRSb2NiaC8RPWY7jtKuKhg65"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "arciumProgram",
          "address": "BKck65TgoKRokMjQM3datB9oRwJ8rAj2jxPXvHXUvcL6"
        },
        {
          "name": "pollAcc",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  117,
                  108,
                  116,
                  105,
                  95,
                  112,
                  111,
                  108,
                  108
                ]
              },
              {
                "kind": "arg",
                "path": "id"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "computationOffset",
          "type": "u64"
        },
        {
          "name": "id",
          "type": "u32"
        },
        {
          "name": "question",
          "type": "string"
        },
        {
          "name": "options",
          "type": {
            "vec": "string"
          }
        },
        {
          "name": "nonce",
          "type": "u128"
        }
      ]
    },
    {
      "name": "createNewPoll",
      "docs": [
        "Creates a new confidential poll with the given question.",
        "",
        "This initializes a poll account and sets up the encrypted vote counters using MPC.",
        "The vote tallies are stored in encrypted form and can only be revealed by the poll authority.",
        "All individual votes remain completely confidential throughout the voting process.",
        "",
        "# Arguments",
        "* `id` - Unique identifier for this poll",
        "* `question` - The poll question voters will respond to",
        "* `nonce` - Cryptographic nonce for initializing encrypted vote counters"
      ],
      "discriminator": [
        18,
        23,
        205,
        123,
        193,
        24,
        162,
        162
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "signPdaAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  83,
                  105,
                  103,
                  110,
                  101,
                  114,
                  65,
                  99,
                  99,
                  111,
                  117,
                  110,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "mxeAccount"
        },
        {
          "name": "mempoolAccount",
          "writable": true
        },
        {
          "name": "executingPool",
          "writable": true
        },
        {
          "name": "computationAccount",
          "writable": true
        },
        {
          "name": "compDefAccount"
        },
        {
          "name": "clusterAccount",
          "writable": true
        },
        {
          "name": "poolAccount",
          "writable": true,
          "address": "7MGSS4iKNM4sVib7bDZDJhVqB6EcchPwVnTKenCY1jt3"
        },
        {
          "name": "clockAccount",
          "address": "FHriyvoZotYiFnbUzKFjzRSb2NiaC8RPWY7jtKuKhg65"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "arciumProgram",
          "address": "BKck65TgoKRokMjQM3datB9oRwJ8rAj2jxPXvHXUvcL6"
        },
        {
          "name": "pollAcc",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  108,
                  108
                ]
              },
              {
                "kind": "arg",
                "path": "id"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "computationOffset",
          "type": "u64"
        },
        {
          "name": "id",
          "type": "u32"
        },
        {
          "name": "question",
          "type": "string"
        },
        {
          "name": "nonce",
          "type": "u128"
        }
      ]
    },
    {
      "name": "initMultiOptionVoteStatsCallback",
      "discriminator": [
        252,
        150,
        167,
        148,
        83,
        170,
        253,
        190
      ],
      "accounts": [
        {
          "name": "arciumProgram",
          "address": "BKck65TgoKRokMjQM3datB9oRwJ8rAj2jxPXvHXUvcL6"
        },
        {
          "name": "compDefAccount"
        },
        {
          "name": "instructionsSysvar",
          "address": "Sysvar1nstructions1111111111111111111111111"
        },
        {
          "name": "pollAcc",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "output",
          "type": {
            "defined": {
              "name": "computationOutputs",
              "generics": [
                {
                  "kind": "type",
                  "type": {
                    "defined": {
                      "name": "initMultiOptionVoteStatsOutput"
                    }
                  }
                }
              ]
            }
          }
        }
      ]
    },
    {
      "name": "initMultiOptionVoteStatsCompDef",
      "discriminator": [
        212,
        156,
        203,
        234,
        42,
        36,
        225,
        49
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "mxeAccount",
          "writable": true
        },
        {
          "name": "compDefAccount",
          "docs": [
            "Can't check it here as it's not initialized yet."
          ],
          "writable": true
        },
        {
          "name": "arciumProgram",
          "address": "BKck65TgoKRokMjQM3datB9oRwJ8rAj2jxPXvHXUvcL6"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "initRevealMultiOptionResultCompDef",
      "discriminator": [
        141,
        249,
        2,
        63,
        199,
        79,
        44,
        255
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "mxeAccount",
          "writable": true
        },
        {
          "name": "compDefAccount",
          "docs": [
            "Can't check it here as it's not initialized yet."
          ],
          "writable": true
        },
        {
          "name": "arciumProgram",
          "address": "BKck65TgoKRokMjQM3datB9oRwJ8rAj2jxPXvHXUvcL6"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "initRevealResultCompDef",
      "discriminator": [
        37,
        58,
        75,
        132,
        146,
        44,
        185,
        221
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "mxeAccount",
          "writable": true
        },
        {
          "name": "compDefAccount",
          "docs": [
            "Can't check it here as it's not initialized yet."
          ],
          "writable": true
        },
        {
          "name": "arciumProgram",
          "address": "BKck65TgoKRokMjQM3datB9oRwJ8rAj2jxPXvHXUvcL6"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "initVoteCompDef",
      "discriminator": [
        227,
        119,
        186,
        182,
        31,
        37,
        236,
        155
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "mxeAccount",
          "writable": true
        },
        {
          "name": "compDefAccount",
          "docs": [
            "Can't check it here as it's not initialized yet."
          ],
          "writable": true
        },
        {
          "name": "arciumProgram",
          "address": "BKck65TgoKRokMjQM3datB9oRwJ8rAj2jxPXvHXUvcL6"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "initVoteMultiOptionCompDef",
      "discriminator": [
        69,
        101,
        4,
        29,
        154,
        102,
        90,
        210
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "mxeAccount",
          "writable": true
        },
        {
          "name": "compDefAccount",
          "docs": [
            "Can't check it here as it's not initialized yet."
          ],
          "writable": true
        },
        {
          "name": "arciumProgram",
          "address": "BKck65TgoKRokMjQM3datB9oRwJ8rAj2jxPXvHXUvcL6"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "initVoteStatsCallback",
      "discriminator": [
        222,
        186,
        167,
        245,
        79,
        226,
        44,
        71
      ],
      "accounts": [
        {
          "name": "arciumProgram",
          "address": "BKck65TgoKRokMjQM3datB9oRwJ8rAj2jxPXvHXUvcL6"
        },
        {
          "name": "compDefAccount"
        },
        {
          "name": "instructionsSysvar",
          "address": "Sysvar1nstructions1111111111111111111111111"
        },
        {
          "name": "pollAcc",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "output",
          "type": {
            "defined": {
              "name": "computationOutputs",
              "generics": [
                {
                  "kind": "type",
                  "type": {
                    "defined": {
                      "name": "initVoteStatsOutput"
                    }
                  }
                }
              ]
            }
          }
        }
      ]
    },
    {
      "name": "initVoteStatsCompDef",
      "discriminator": [
        7,
        191,
        118,
        167,
        173,
        92,
        25,
        179
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "mxeAccount",
          "writable": true
        },
        {
          "name": "compDefAccount",
          "docs": [
            "Can't check it here as it's not initialized yet."
          ],
          "writable": true
        },
        {
          "name": "arciumProgram",
          "address": "BKck65TgoKRokMjQM3datB9oRwJ8rAj2jxPXvHXUvcL6"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "revealMultiOptionResult",
      "docs": [
        "Reveals the vote counts for a multi-option poll.",
        "",
        "Only the poll authority can call this function to decrypt and reveal",
        "the vote counts for all options. Returns raw counts array [u64; 4].",
        "",
        "# Arguments",
        "* `id` - The poll ID to reveal results for"
      ],
      "discriminator": [
        87,
        93,
        96,
        242,
        44,
        167,
        138,
        150
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "signPdaAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  83,
                  105,
                  103,
                  110,
                  101,
                  114,
                  65,
                  99,
                  99,
                  111,
                  117,
                  110,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "mxeAccount"
        },
        {
          "name": "mempoolAccount",
          "writable": true
        },
        {
          "name": "executingPool",
          "writable": true
        },
        {
          "name": "computationAccount",
          "writable": true
        },
        {
          "name": "compDefAccount"
        },
        {
          "name": "clusterAccount",
          "writable": true
        },
        {
          "name": "poolAccount",
          "writable": true,
          "address": "7MGSS4iKNM4sVib7bDZDJhVqB6EcchPwVnTKenCY1jt3"
        },
        {
          "name": "clockAccount",
          "address": "FHriyvoZotYiFnbUzKFjzRSb2NiaC8RPWY7jtKuKhg65"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "arciumProgram",
          "address": "BKck65TgoKRokMjQM3datB9oRwJ8rAj2jxPXvHXUvcL6"
        },
        {
          "name": "pollAcc",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  117,
                  108,
                  116,
                  105,
                  95,
                  112,
                  111,
                  108,
                  108
                ]
              },
              {
                "kind": "arg",
                "path": "id"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "computationOffset",
          "type": "u64"
        },
        {
          "name": "id",
          "type": "u32"
        }
      ]
    },
    {
      "name": "revealMultiOptionResultCallback",
      "discriminator": [
        40,
        70,
        170,
        124,
        69,
        158,
        190,
        67
      ],
      "accounts": [
        {
          "name": "arciumProgram",
          "address": "BKck65TgoKRokMjQM3datB9oRwJ8rAj2jxPXvHXUvcL6"
        },
        {
          "name": "compDefAccount"
        },
        {
          "name": "instructionsSysvar",
          "address": "Sysvar1nstructions1111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "output",
          "type": {
            "defined": {
              "name": "computationOutputs",
              "generics": [
                {
                  "kind": "type",
                  "type": {
                    "defined": {
                      "name": "revealMultiOptionResultOutput"
                    }
                  }
                }
              ]
            }
          }
        }
      ]
    },
    {
      "name": "revealResult",
      "docs": [
        "Reveals the final result of the poll.",
        "",
        "Only the poll authority can call this function to decrypt and reveal the vote tallies.",
        "The MPC computation compares the yes and no vote counts and returns whether",
        "the majority voted yes (true) or no (false).",
        "",
        "# Arguments",
        "* `id` - The poll ID to reveal results for"
      ],
      "discriminator": [
        251,
        165,
        27,
        86,
        52,
        234,
        133,
        173
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "signPdaAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  83,
                  105,
                  103,
                  110,
                  101,
                  114,
                  65,
                  99,
                  99,
                  111,
                  117,
                  110,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "mxeAccount"
        },
        {
          "name": "mempoolAccount",
          "writable": true
        },
        {
          "name": "executingPool",
          "writable": true
        },
        {
          "name": "computationAccount",
          "writable": true
        },
        {
          "name": "compDefAccount"
        },
        {
          "name": "clusterAccount",
          "writable": true
        },
        {
          "name": "poolAccount",
          "writable": true,
          "address": "7MGSS4iKNM4sVib7bDZDJhVqB6EcchPwVnTKenCY1jt3"
        },
        {
          "name": "clockAccount",
          "address": "FHriyvoZotYiFnbUzKFjzRSb2NiaC8RPWY7jtKuKhg65"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "arciumProgram",
          "address": "BKck65TgoKRokMjQM3datB9oRwJ8rAj2jxPXvHXUvcL6"
        },
        {
          "name": "pollAcc",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  108,
                  108
                ]
              },
              {
                "kind": "arg",
                "path": "id"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "computationOffset",
          "type": "u64"
        },
        {
          "name": "id",
          "type": "u32"
        }
      ]
    },
    {
      "name": "revealResultCallback",
      "discriminator": [
        135,
        166,
        225,
        246,
        62,
        43,
        157,
        198
      ],
      "accounts": [
        {
          "name": "arciumProgram",
          "address": "BKck65TgoKRokMjQM3datB9oRwJ8rAj2jxPXvHXUvcL6"
        },
        {
          "name": "compDefAccount"
        },
        {
          "name": "instructionsSysvar",
          "address": "Sysvar1nstructions1111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "output",
          "type": {
            "defined": {
              "name": "computationOutputs",
              "generics": [
                {
                  "kind": "type",
                  "type": {
                    "defined": {
                      "name": "revealResultOutput"
                    }
                  }
                }
              ]
            }
          }
        }
      ]
    },
    {
      "name": "vote",
      "docs": [
        "Submits an encrypted vote to the poll.",
        "",
        "This function allows a voter to cast their vote (yes/no) in encrypted form.",
        "The vote is added to the running tally through MPC computation, ensuring",
        "that individual votes remain confidential while updating the overall count.",
        "",
        "# Arguments",
        "* `vote` - Encrypted vote (true for yes, false for no)",
        "* `vote_encryption_pubkey` - Voter's public key for encryption",
        "* `vote_nonce` - Cryptographic nonce for the vote encryption"
      ],
      "discriminator": [
        227,
        110,
        155,
        23,
        136,
        126,
        172,
        25
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "signPdaAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  83,
                  105,
                  103,
                  110,
                  101,
                  114,
                  65,
                  99,
                  99,
                  111,
                  117,
                  110,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "mxeAccount"
        },
        {
          "name": "mempoolAccount",
          "writable": true
        },
        {
          "name": "executingPool",
          "writable": true
        },
        {
          "name": "computationAccount",
          "writable": true
        },
        {
          "name": "compDefAccount"
        },
        {
          "name": "clusterAccount",
          "writable": true
        },
        {
          "name": "poolAccount",
          "writable": true,
          "address": "7MGSS4iKNM4sVib7bDZDJhVqB6EcchPwVnTKenCY1jt3"
        },
        {
          "name": "clockAccount",
          "address": "FHriyvoZotYiFnbUzKFjzRSb2NiaC8RPWY7jtKuKhg65"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "arciumProgram",
          "address": "BKck65TgoKRokMjQM3datB9oRwJ8rAj2jxPXvHXUvcL6"
        },
        {
          "name": "pollAcc",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  108,
                  108
                ]
              },
              {
                "kind": "arg",
                "path": "id"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "computationOffset",
          "type": "u64"
        },
        {
          "name": "id",
          "type": "u32"
        },
        {
          "name": "vote",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "voteEncryptionPubkey",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "voteNonce",
          "type": "u128"
        }
      ]
    },
    {
      "name": "voteCallback",
      "discriminator": [
        129,
        42,
        124,
        58,
        180,
        43,
        128,
        155
      ],
      "accounts": [
        {
          "name": "arciumProgram",
          "address": "BKck65TgoKRokMjQM3datB9oRwJ8rAj2jxPXvHXUvcL6"
        },
        {
          "name": "compDefAccount"
        },
        {
          "name": "instructionsSysvar",
          "address": "Sysvar1nstructions1111111111111111111111111"
        },
        {
          "name": "pollAcc",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "output",
          "type": {
            "defined": {
              "name": "computationOutputs",
              "generics": [
                {
                  "kind": "type",
                  "type": {
                    "defined": {
                      "name": "voteOutput"
                    }
                  }
                }
              ]
            }
          }
        }
      ]
    },
    {
      "name": "voteMultiOption",
      "docs": [
        "Submits an encrypted vote to a multi-option poll.",
        "",
        "The voter selects one option (0-3), which is encrypted and added to the",
        "corresponding counter through MPC. Individual votes remain confidential.",
        "",
        "# Arguments",
        "* `selected_option_encrypted` - Encrypted selected option index (0-3)",
        "* `vote_encryption_pubkey` - Voter's public key for encryption",
        "* `vote_nonce` - Cryptographic nonce for the vote encryption"
      ],
      "discriminator": [
        80,
        99,
        113,
        248,
        53,
        170,
        222,
        255
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "signPdaAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  83,
                  105,
                  103,
                  110,
                  101,
                  114,
                  65,
                  99,
                  99,
                  111,
                  117,
                  110,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "mxeAccount"
        },
        {
          "name": "mempoolAccount",
          "writable": true
        },
        {
          "name": "executingPool",
          "writable": true
        },
        {
          "name": "computationAccount",
          "writable": true
        },
        {
          "name": "compDefAccount"
        },
        {
          "name": "clusterAccount",
          "writable": true
        },
        {
          "name": "poolAccount",
          "writable": true,
          "address": "7MGSS4iKNM4sVib7bDZDJhVqB6EcchPwVnTKenCY1jt3"
        },
        {
          "name": "clockAccount",
          "address": "FHriyvoZotYiFnbUzKFjzRSb2NiaC8RPWY7jtKuKhg65"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "arciumProgram",
          "address": "BKck65TgoKRokMjQM3datB9oRwJ8rAj2jxPXvHXUvcL6"
        },
        {
          "name": "pollAcc",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  117,
                  108,
                  116,
                  105,
                  95,
                  112,
                  111,
                  108,
                  108
                ]
              },
              {
                "kind": "arg",
                "path": "id"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "computationOffset",
          "type": "u64"
        },
        {
          "name": "id",
          "type": "u32"
        },
        {
          "name": "selectedOptionEncrypted",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "voteEncryptionPubkey",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "voteNonce",
          "type": "u128"
        }
      ]
    },
    {
      "name": "voteMultiOptionCallback",
      "discriminator": [
        223,
        138,
        7,
        233,
        50,
        203,
        221,
        191
      ],
      "accounts": [
        {
          "name": "arciumProgram",
          "address": "BKck65TgoKRokMjQM3datB9oRwJ8rAj2jxPXvHXUvcL6"
        },
        {
          "name": "compDefAccount"
        },
        {
          "name": "instructionsSysvar",
          "address": "Sysvar1nstructions1111111111111111111111111"
        },
        {
          "name": "pollAcc",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "output",
          "type": {
            "defined": {
              "name": "computationOutputs",
              "generics": [
                {
                  "kind": "type",
                  "type": {
                    "defined": {
                      "name": "voteMultiOptionOutput"
                    }
                  }
                }
              ]
            }
          }
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "clockAccount",
      "discriminator": [
        152,
        171,
        158,
        195,
        75,
        61,
        51,
        8
      ]
    },
    {
      "name": "cluster",
      "discriminator": [
        236,
        225,
        118,
        228,
        173,
        106,
        18,
        60
      ]
    },
    {
      "name": "computationDefinitionAccount",
      "discriminator": [
        245,
        176,
        217,
        221,
        253,
        104,
        172,
        200
      ]
    },
    {
      "name": "feePool",
      "discriminator": [
        172,
        38,
        77,
        146,
        148,
        5,
        51,
        242
      ]
    },
    {
      "name": "mxeAccount",
      "discriminator": [
        103,
        26,
        85,
        250,
        179,
        159,
        17,
        117
      ]
    },
    {
      "name": "multiOptionPollAccount",
      "discriminator": [
        154,
        48,
        253,
        202,
        187,
        30,
        226,
        212
      ]
    },
    {
      "name": "pollAccount",
      "discriminator": [
        109,
        254,
        117,
        41,
        232,
        74,
        172,
        45
      ]
    },
    {
      "name": "signerAccount",
      "discriminator": [
        127,
        212,
        7,
        180,
        17,
        50,
        249,
        193
      ]
    }
  ],
  "events": [
    {
      "name": "revealMultiOptionResultEvent",
      "discriminator": [
        13,
        44,
        202,
        4,
        94,
        61,
        41,
        67
      ]
    },
    {
      "name": "revealResultEvent",
      "discriminator": [
        20,
        154,
        125,
        179,
        190,
        191,
        232,
        228
      ]
    },
    {
      "name": "voteEvent",
      "discriminator": [
        195,
        71,
        250,
        105,
        120,
        119,
        234,
        134
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "invalidAuthority",
      "msg": "Invalid authority"
    },
    {
      "code": 6001,
      "name": "abortedComputation",
      "msg": "The computation was aborted"
    },
    {
      "code": 6002,
      "name": "clusterNotSet",
      "msg": "Cluster not set"
    },
    {
      "code": 6003,
      "name": "invalidOptionCount",
      "msg": "Invalid option count - must be between 2 and 4"
    }
  ],
  "types": [
    {
      "name": "activation",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "activationEpoch",
            "type": {
              "defined": {
                "name": "epoch"
              }
            }
          },
          {
            "name": "deactivationEpoch",
            "type": {
              "defined": {
                "name": "epoch"
              }
            }
          }
        ]
      }
    },
    {
      "name": "circuitSource",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "local",
            "fields": [
              {
                "defined": {
                  "name": "localCircuitSource"
                }
              }
            ]
          },
          {
            "name": "onChain",
            "fields": [
              {
                "defined": {
                  "name": "onChainCircuitSource"
                }
              }
            ]
          },
          {
            "name": "offChain",
            "fields": [
              {
                "defined": {
                  "name": "offChainCircuitSource"
                }
              }
            ]
          }
        ]
      }
    },
    {
      "name": "clockAccount",
      "docs": [
        "An account storing the current network epoch"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "startEpoch",
            "type": {
              "defined": {
                "name": "epoch"
              }
            }
          },
          {
            "name": "currentEpoch",
            "type": {
              "defined": {
                "name": "epoch"
              }
            }
          },
          {
            "name": "startEpochTimestamp",
            "type": {
              "defined": {
                "name": "timestamp"
              }
            }
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "cluster",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "maxSize",
            "type": "u32"
          },
          {
            "name": "activation",
            "type": {
              "defined": {
                "name": "activation"
              }
            }
          },
          {
            "name": "maxCapacity",
            "type": "u64"
          },
          {
            "name": "cuPrice",
            "type": "u64"
          },
          {
            "name": "cuPriceProposals",
            "type": {
              "array": [
                "u64",
                32
              ]
            }
          },
          {
            "name": "lastUpdatedEpoch",
            "type": {
              "defined": {
                "name": "epoch"
              }
            }
          },
          {
            "name": "mxes",
            "type": {
              "vec": "pubkey"
            }
          },
          {
            "name": "nodes",
            "type": {
              "vec": {
                "defined": {
                  "name": "nodeRef"
                }
              }
            }
          },
          {
            "name": "pendingNodes",
            "type": {
              "vec": {
                "defined": {
                  "name": "nodeRef"
                }
              }
            }
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "computationDefinitionAccount",
      "docs": [
        "An account representing a [ComputationDefinition] in a MXE."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "finalizationAuthority",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "finalizeDuringCallback",
            "type": "bool"
          },
          {
            "name": "cuAmount",
            "type": "u64"
          },
          {
            "name": "definition",
            "type": {
              "defined": {
                "name": "computationDefinitionMeta"
              }
            }
          },
          {
            "name": "circuitSource",
            "type": {
              "defined": {
                "name": "circuitSource"
              }
            }
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "computationDefinitionMeta",
      "docs": [
        "A computation definition for execution in a MXE."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "circuitLen",
            "type": "u32"
          },
          {
            "name": "signature",
            "type": {
              "defined": {
                "name": "computationSignature"
              }
            }
          }
        ]
      }
    },
    {
      "name": "computationOutputs",
      "generics": [
        {
          "kind": "type",
          "name": "o"
        }
      ],
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "success",
            "fields": [
              {
                "generic": "o"
              }
            ]
          },
          {
            "name": "failure"
          }
        ]
      }
    },
    {
      "name": "computationSignature",
      "docs": [
        "The signature of a computation defined in a [ComputationDefinition]."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "parameters",
            "type": {
              "vec": {
                "defined": {
                  "name": "parameter"
                }
              }
            }
          },
          {
            "name": "outputs",
            "type": {
              "vec": {
                "defined": {
                  "name": "output"
                }
              }
            }
          }
        ]
      }
    },
    {
      "name": "epoch",
      "docs": [
        "The network epoch"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          "u64"
        ]
      }
    },
    {
      "name": "feePool",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "initMultiOptionVoteStatsOutput",
      "docs": [
        "The output of the callback instruction. Provided as a struct with ordered fields",
        "as anchor does not support tuples and tuple structs yet."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "field0",
            "type": {
              "defined": {
                "name": "mxeEncryptedStruct",
                "generics": [
                  {
                    "kind": "const",
                    "value": "5"
                  }
                ]
              }
            }
          }
        ]
      }
    },
    {
      "name": "initVoteStatsOutput",
      "docs": [
        "The output of the callback instruction. Provided as a struct with ordered fields",
        "as anchor does not support tuples and tuple structs yet."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "field0",
            "type": {
              "defined": {
                "name": "mxeEncryptedStruct",
                "generics": [
                  {
                    "kind": "const",
                    "value": "2"
                  }
                ]
              }
            }
          }
        ]
      }
    },
    {
      "name": "localCircuitSource",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "mxeKeygen"
          }
        ]
      }
    },
    {
      "name": "mxeAccount",
      "docs": [
        "A MPC Execution Environment."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "cluster",
            "type": {
              "option": "u32"
            }
          },
          {
            "name": "x25519Pubkey",
            "type": {
              "defined": {
                "name": "x25519Pubkey"
              }
            }
          },
          {
            "name": "fallbackClusters",
            "type": {
              "vec": "u32"
            }
          },
          {
            "name": "rejectedClusters",
            "type": {
              "vec": "u32"
            }
          },
          {
            "name": "computationDefinitions",
            "type": {
              "vec": "u32"
            }
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "mxeEncryptedStruct",
      "generics": [
        {
          "kind": "const",
          "name": "len",
          "type": "usize"
        }
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "nonce",
            "type": "u128"
          },
          {
            "name": "ciphertexts",
            "type": {
              "array": [
                {
                  "array": [
                    "u8",
                    32
                  ]
                },
                {
                  "generic": "len"
                }
              ]
            }
          }
        ]
      }
    },
    {
      "name": "multiOptionPollAccount",
      "docs": [
        "Represents a multi-option poll (2-4 options) for DAO voting."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "docs": [
              "PDA bump seed"
            ],
            "type": "u8"
          },
          {
            "name": "voteState",
            "docs": [
              "Encrypted vote counters: [option1, option2, option3, option4, num_options] as 32-byte ciphertexts"
            ],
            "type": {
              "array": [
                {
                  "array": [
                    "u8",
                    32
                  ]
                },
                5
              ]
            }
          },
          {
            "name": "id",
            "docs": [
              "Unique identifier for this poll"
            ],
            "type": "u32"
          },
          {
            "name": "authority",
            "docs": [
              "Public key of the poll creator (only they can reveal results)"
            ],
            "type": "pubkey"
          },
          {
            "name": "nonce",
            "docs": [
              "Cryptographic nonce for the encrypted vote counters"
            ],
            "type": "u128"
          },
          {
            "name": "question",
            "docs": [
              "The poll question (max 100 characters)"
            ],
            "type": "string"
          },
          {
            "name": "options",
            "docs": [
              "Poll options (2-4 strings, max 50 characters each)"
            ],
            "type": {
              "vec": "string"
            }
          },
          {
            "name": "numOptions",
            "docs": [
              "Number of options (2-4)"
            ],
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "nodeRef",
      "docs": [
        "A reference to a node in the cluster.",
        "The offset is to derive the Node Account.",
        "The current_total_rewards is the total rewards the node has received so far in the current",
        "epoch."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "offset",
            "type": "u32"
          },
          {
            "name": "currentTotalRewards",
            "type": "u64"
          },
          {
            "name": "vote",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "offChainCircuitSource",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "source",
            "type": "string"
          },
          {
            "name": "hash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          }
        ]
      }
    },
    {
      "name": "onChainCircuitSource",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "isCompleted",
            "type": "bool"
          },
          {
            "name": "uploadAuth",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "output",
      "docs": [
        "An output of a computation.",
        "We currently don't support encrypted outputs yet since encrypted values are passed via",
        "data objects."
      ],
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "plaintextBool"
          },
          {
            "name": "plaintextU8"
          },
          {
            "name": "plaintextU16"
          },
          {
            "name": "plaintextU32"
          },
          {
            "name": "plaintextU64"
          },
          {
            "name": "plaintextU128"
          },
          {
            "name": "ciphertext"
          },
          {
            "name": "arcisPubkey"
          },
          {
            "name": "plaintextFloat"
          }
        ]
      }
    },
    {
      "name": "parameter",
      "docs": [
        "A parameter of a computation.",
        "We differentiate between plaintext and encrypted parameters and data objects.",
        "Plaintext parameters are directly provided as their value.",
        "Encrypted parameters are provided as an offchain reference to the data.",
        "Data objects are provided as a reference to the data object account."
      ],
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "plaintextBool"
          },
          {
            "name": "plaintextU8"
          },
          {
            "name": "plaintextU16"
          },
          {
            "name": "plaintextU32"
          },
          {
            "name": "plaintextU64"
          },
          {
            "name": "plaintextU128"
          },
          {
            "name": "ciphertext"
          },
          {
            "name": "arcisPubkey"
          },
          {
            "name": "arcisSignature"
          },
          {
            "name": "plaintextFloat"
          },
          {
            "name": "manticoreAlgo"
          },
          {
            "name": "inputDataset"
          }
        ]
      }
    },
    {
      "name": "pollAccount",
      "docs": [
        "Represents a confidential poll with encrypted vote tallies."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "docs": [
              "PDA bump seed"
            ],
            "type": "u8"
          },
          {
            "name": "voteState",
            "docs": [
              "Encrypted vote counters: [yes_count, no_count] as 32-byte ciphertexts"
            ],
            "type": {
              "array": [
                {
                  "array": [
                    "u8",
                    32
                  ]
                },
                2
              ]
            }
          },
          {
            "name": "id",
            "docs": [
              "Unique identifier for this poll"
            ],
            "type": "u32"
          },
          {
            "name": "authority",
            "docs": [
              "Public key of the poll creator (only they can reveal results)"
            ],
            "type": "pubkey"
          },
          {
            "name": "nonce",
            "docs": [
              "Cryptographic nonce for the encrypted vote counters"
            ],
            "type": "u128"
          },
          {
            "name": "question",
            "docs": [
              "The poll question (max 50 characters)"
            ],
            "type": "string"
          }
        ]
      }
    },
    {
      "name": "revealMultiOptionResultEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "option1Count",
            "type": "u64"
          },
          {
            "name": "option2Count",
            "type": "u64"
          },
          {
            "name": "option3Count",
            "type": "u64"
          },
          {
            "name": "option4Count",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "revealMultiOptionResultOutput",
      "docs": [
        "The output of the callback instruction. Provided as a struct with ordered fields",
        "as anchor does not support tuples and tuple structs yet."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "field0",
            "type": {
              "array": [
                "u64",
                4
              ]
            }
          }
        ]
      }
    },
    {
      "name": "revealResultEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "output",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "revealResultOutput",
      "docs": [
        "The output of the callback instruction. Provided as a struct with ordered fields",
        "as anchor does not support tuples and tuple structs yet."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "field0",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "signerAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "timestamp",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "timestamp",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "voteEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "voteMultiOptionOutput",
      "docs": [
        "The output of the callback instruction. Provided as a struct with ordered fields",
        "as anchor does not support tuples and tuple structs yet."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "field0",
            "type": {
              "defined": {
                "name": "mxeEncryptedStruct",
                "generics": [
                  {
                    "kind": "const",
                    "value": "5"
                  }
                ]
              }
            }
          }
        ]
      }
    },
    {
      "name": "voteOutput",
      "docs": [
        "The output of the callback instruction. Provided as a struct with ordered fields",
        "as anchor does not support tuples and tuple structs yet."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "field0",
            "type": {
              "defined": {
                "name": "mxeEncryptedStruct",
                "generics": [
                  {
                    "kind": "const",
                    "value": "2"
                  }
                ]
              }
            }
          }
        ]
      }
    },
    {
      "name": "x25519Pubkey",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "set",
            "fields": [
              {
                "array": [
                  "u8",
                  32
                ]
              }
            ]
          },
          {
            "name": "unset",
            "fields": [
              {
                "array": [
                  "u8",
                  32
                ]
              },
              {
                "vec": "bool"
              }
            ]
          }
        ]
      }
    }
  ]
};
